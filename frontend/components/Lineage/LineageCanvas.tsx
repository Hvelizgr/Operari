'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeTypes,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  type NodeTypes,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { AlertTriangle, ArrowRight, Loader2, Workflow } from 'lucide-react';
import Link from 'next/link';
import { memo, useEffect, useMemo, useState } from 'react';

import { useDiagramExport } from '@/hooks/useDiagramExport';
import { useLineagePrefs } from '@/lib/userPrefs';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface LineageNode {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
}

interface LineageEdge {
  source: string;
  target: string;
  kind: 'runbook-step' | 'on-error';
  stepId?: string;
  stepName?: string;
}

interface LineagePayload {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

type RfLineageNodeData = LineageNode & Record<string, unknown>;
type RfLineageNode = Node<RfLineageNodeData, 'lineage.runbook'>;
type RfLineageEdgeData = { kind: LineageEdge['kind']; stepName?: string } & Record<string, unknown>;
type RfLineageEdge = Edge<RfLineageEdgeData>;

const RUNBOOK_NODE_WIDTH = 220;
const RUNBOOK_NODE_HEIGHT = 64;

function RunbookNodeComponent({ data, selected }: NodeProps<RfLineageNode>) {
  return (
    <Link
      href={`/editor?id=${data.id}`}
      className={`block rounded-lg border bg-zinc-950 px-3 py-2 shadow-xl transition-colors hover:border-emerald-400 ${
        selected ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-zinc-700'
      }`}
      style={{ width: RUNBOOK_NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#52525b' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#52525b' }} />
      <div className="flex items-center gap-2">
        <Workflow size={12} className="shrink-0 text-emerald-400" />
        <span className="truncate text-sm font-semibold text-white">{data.name}</span>
      </div>
      {data.slug ? (
        <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">{data.slug}</div>
      ) : null}
      {data.category ? (
        <span className="mt-1 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-400">
          {data.category}
        </span>
      ) : null}
    </Link>
  );
}

const RunbookNode = memo(RunbookNodeComponent);

const nodeTypes: NodeTypes = { 'lineage.runbook': RunbookNode };
const edgeTypes: EdgeTypes = {};

interface LineageCanvasProps {
  lang: 'en' | 'es';
}

/**
 * Drop edges/nodes the user wants hidden via Lineage prefs.
 *   - hideOnErrorEdges: filter out the `on-error` edge kind so the
 *     graph shows only explicit runbook-step calls.
 *   - groupByCategory is applied at layout time, not here.
 */
function applyLineageFilters(
  payload: LineagePayload,
  prefs: { hideOnErrorEdges: boolean; groupByCategory: boolean }
): LineagePayload {
  if (!prefs.hideOnErrorEdges) return payload;
  return {
    nodes: payload.nodes,
    edges: payload.edges.filter(e => e.kind !== 'on-error'),
  };
}

function layoutLineage(
  payload: LineagePayload,
  prefs: { groupByCategory: boolean; hideOnErrorEdges: boolean }
): {
  nodes: RfLineageNode[];
  edges: RfLineageEdge[];
} {
  // Compute roots (nodes with no incoming edges) and lay out columns
  // by reachable depth from any root. Falls back to alphabetical
  // grouping for cyclical / orphan clusters so an isolated runbook
  // never hides off-screen.
  const inDegree = new Map<string, number>();
  for (const node of payload.nodes) inDegree.set(node.id, 0);
  for (const edge of payload.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of payload.edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      depth.set(id, 0);
      queue.push(id);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    for (const next of adjacency.get(id) ?? []) {
      const candidate = d + 1;
      if (!depth.has(next) || (depth.get(next) ?? 0) < candidate) {
        depth.set(next, candidate);
        queue.push(next);
      }
    }
  }
  // Anything still without depth (cycle) goes into a final column.
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  for (const node of payload.nodes) {
    if (!depth.has(node.id)) depth.set(node.id, maxDepth + 1);
  }

  // When `groupByCategory` is on we slot nodes by `(depth, category)`
  // so siblings of the same category sit together in the column.
  // When off we use a simple `depth` keyed bucket.
  const byColumn = new Map<number, LineageNode[]>();
  for (const node of payload.nodes) {
    const col = depth.get(node.id) ?? 0;
    const bucket = byColumn.get(col) ?? [];
    bucket.push(node);
    byColumn.set(col, bucket);
  }
  for (const bucket of byColumn.values()) {
    if (prefs.groupByCategory) {
      bucket.sort((a, b) => {
        const ca = a.category ?? 'zzz';
        const cb = b.category ?? 'zzz';
        if (ca !== cb) return ca.localeCompare(cb);
        return a.name.localeCompare(b.name);
      });
    } else {
      bucket.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  const COL_GAP = 320;
  const ROW_GAP = 96;
  const rfNodes: RfLineageNode[] = [];
  for (const [col, bucket] of byColumn) {
    bucket.forEach((node, idx) => {
      rfNodes.push({
        id: node.id,
        type: 'lineage.runbook',
        position: { x: col * COL_GAP, y: idx * ROW_GAP },
        data: { ...node },
        width: RUNBOOK_NODE_WIDTH,
        height: RUNBOOK_NODE_HEIGHT,
      });
    });
  }

  const rfEdges: RfLineageEdge[] = payload.edges.map((edge, idx) => ({
    id: `e${idx}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: edge.kind === 'on-error',
    style: {
      stroke: edge.kind === 'on-error' ? '#fb923c' : '#71717a',
      strokeDasharray: edge.kind === 'on-error' ? '4 3' : undefined,
      strokeWidth: 1.4,
    },
    label: edge.stepName,
    labelStyle: { fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' },
    labelBgStyle: { fill: '#18181b' },
    data: { kind: edge.kind, stepName: edge.stepName },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

function LineageCanvasInner({ lang }: LineageCanvasProps) {
  const [payload, setPayload] = useState<LineagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<RfLineageNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RfLineageEdge>([]);
  const { fitView } = useReactFlow();
  const { exportImage, exporting } = useDiagramExport();
  const [lineagePrefs] = useLineagePrefs();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/runbooks/lineage`, { credentials: 'include' })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as LineagePayload;
        if (cancelled) return;
        setPayload(body);
        // Apply user filters BEFORE layout so the depth math doesn't
        // include nodes/edges we'll just hide afterwards.
        const filtered = applyLineageFilters(body, lineagePrefs);
        const laid = layoutLineage(filtered, lineagePrefs);
        setNodes(laid.nodes);
        setEdges(laid.edges);
        setTimeout(() => fitView({ padding: 0.15, maxZoom: 1 }), 50);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fitView, setNodes, setEdges, lineagePrefs]);

  const counts = useMemo(() => {
    if (!payload) return { runbooks: 0, calls: 0, onError: 0 };
    return {
      runbooks: payload.nodes.length,
      calls: payload.edges.filter(e => e.kind === 'runbook-step').length,
      onError: payload.edges.filter(e => e.kind === 'on-error').length,
    };
  }, [payload]);

  const t =
    lang === 'es'
      ? {
          title: 'Lineage de runbooks',
          subtitle: `${counts.runbooks} runbooks · ${counts.calls} llamadas · ${counts.onError} on-error`,
          empty: 'Aún no hay runbooks',
          emptyHint: 'Creá tu primer runbook desde la lista para ver el grafo de llamadas.',
          emptyCta: 'Ir a Runbooks',
          loading: 'Cargando lineage…',
          export: 'Exportar PNG',
          legendCall: 'Llamada de runbook',
          legendOnError: 'Handler on-error',
        }
      : {
          title: 'Runbook lineage',
          subtitle: `${counts.runbooks} runbooks · ${counts.calls} calls · ${counts.onError} on-error`,
          empty: 'No runbooks yet',
          emptyHint: 'Create your first runbook from the list to see the call graph.',
          emptyCta: 'Go to Runbooks',
          loading: 'Loading lineage…',
          export: 'Export PNG',
          legendCall: 'Runbook call',
          legendOnError: 'On-error handler',
        };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-sm text-rose-400">
        <AlertTriangle size={16} className="mr-2" />
        {error}
      </div>
    );
  }

  if (!loading && payload && payload.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center">
        <Workflow size={28} className="text-zinc-700" />
        <div className="text-sm font-semibold text-zinc-300">{t.empty}</div>
        <div className="max-w-sm text-xs text-zinc-500">{t.emptyHint}</div>
        <Link
          href={`/${lang}/runbooks`}
          className="mt-2 rounded border border-emerald-700 bg-emerald-900/30 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-900/60"
        >
          {t.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
        <Controls
          showInteractive={false}
          className="!border-zinc-700 !bg-zinc-900 [&_button]:!border-zinc-700 [&_button]:!bg-zinc-900 [&_button]:!text-zinc-300"
        />
        <MiniMap pannable zoomable className="!border-zinc-700 !bg-zinc-900" nodeColor="#3f3f46" />
        <Panel
          position="top-left"
          className="rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur"
        >
          <div className="text-sm font-bold text-white">{t.title}</div>
          <div className="text-[10px] text-zinc-500">{t.subtitle}</div>
        </Panel>
        <Panel
          position="top-right"
          className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-[10px] shadow-xl backdrop-blur"
        >
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="h-px w-4 bg-zinc-500" />
            <ArrowRight size={9} className="text-zinc-500" />
            {t.legendCall}
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="h-px w-4" style={{ background: '#fb923c' }} />
            <ArrowRight size={9} style={{ color: '#fb923c' }} />
            {t.legendOnError}
          </span>
          <button
            type="button"
            onClick={() => exportImage('png', 'runbook-lineage.png')}
            disabled={exporting}
            className="ml-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            {exporting ? <Loader2 size={9} className="inline animate-spin" /> : t.export}
          </button>
        </Panel>
        {loading ? (
          <Panel
            position="bottom-center"
            className="rounded-full bg-zinc-900/90 px-3 py-1 text-[10px] text-zinc-400 shadow-xl backdrop-blur"
          >
            <Loader2 size={10} className="mr-1 inline animate-spin" />
            {t.loading}
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  );
}

export default memo(function LineageCanvas(props: LineageCanvasProps) {
  return (
    <ReactFlowProvider>
      <LineageCanvasInner {...props} />
    </ReactFlowProvider>
  );
});
