'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  type EdgeTypes,
  MiniMap,
  type NodeTypes,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { Download, FileCode, FileImage, GitCompare, Loader2, Upload, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useDiagramExport } from '@/hooks/useDiagramExport';
import { exportDbml } from '@/lib/sql/dbml-export';
import { diffMetadata, type SchemaDiff } from '@/lib/sql/diff';
import { groupMetadata, type SqlMetadata, sqlMetadataSchema, tableKey } from '@/lib/sql/metadata';

import { layoutSchema } from './layout';
import { RelationshipEdge } from './RelationshipEdge';
import { TableNode } from './TableNode';
import type { SchemaEdge, SchemaNode } from './types';

const nodeTypes: NodeTypes = { 'schema.table': TableNode };
const edgeTypes: EdgeTypes = { 'schema.fk': RelationshipEdge };

interface SchemaDiagramProps {
  metadata: SqlMetadata;
  /** Optional set of `schema` strings; tables whose schema is not in
   *  the set are hidden together with their relationships. Undefined
   *  means "show everything" (initial state when filter is closed). */
  visibleSchemas?: ReadonlySet<string>;
  lang: 'en' | 'es';
}

/**
 * Schema visualizer canvas. Loads the metadata payload, runs an
 * elkjs layout off the main render and feeds React Flow. The
 * surrounding shell (filter, toolbar) is owned by the parent so this
 * component stays focused on the graph render.
 *
 * Inspired by chartdb's editor canvas (AGPL — see
 * docs/research/chartdb-research.md). We keep our own table-node
 * shape so it slots into our brand tokens and keeps the bundle small.
 */
function SchemaDiagramInner({ metadata, visibleSchemas, lang }: SchemaDiagramProps) {
  const grouped = useMemo(() => groupMetadata(metadata), [metadata]);
  const [nodes, setNodes, onNodesChange] = useNodesState<SchemaNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<SchemaEdge>([]);
  const [loading, setLoading] = useState(false);
  const { fitView } = useReactFlow();
  const { exportImage, exporting } = useDiagramExport();
  const exportBaseName = `${metadata.databaseName ?? 'schema'}-diagram`;

  // Optional diff baseline. The user uploads a previously-exported
  // metadata JSON; we compute a SchemaDiff and the renderer colors
  // tables / FKs by their status. Stored in component state because
  // it's a transient comparison view, not part of any persisted
  // editor state.
  const [baselineMetadata, setBaselineMetadata] = useState<SqlMetadata | null>(null);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const diff: SchemaDiff | null = useMemo(
    () => (baselineMetadata ? diffMetadata(baselineMetadata, metadata) : null),
    [baselineMetadata, metadata]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    layoutSchema(grouped)
      .then(({ nodes: laidOutNodes, edges: laidOutEdges }) => {
        if (cancelled) return;
        setNodes(laidOutNodes);
        setEdges(laidOutEdges);
        // Fit-view runs in the next tick so RF has measured the
        // freshly-rendered nodes; without the timeout fitView
        // computes against zero-sized placeholders.
        setTimeout(() => fitView({ padding: 0.15, maxZoom: 1 }), 50);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grouped, fitView, setNodes, setEdges]);

  // Apply schema visibility by toggling each node's `hidden` flag and
  // hiding any edge whose endpoints fall outside the visible set.
  // Mutating in-place would clobber drag-driven position updates, so
  // we map into a fresh array each pass.
  const visibleNodes = useMemo(() => {
    return nodes.map(n => {
      const tDiff = diff?.tables.get(tableKey(n.data.table.schema, n.data.table.name));
      const data: SchemaNode['data'] = tDiff
        ? { table: n.data.table, diff: tDiff }
        : { table: n.data.table };
      const hidden = visibleSchemas ? !visibleSchemas.has(n.data.table.schema) : false;
      return { ...n, hidden, data };
    });
  }, [nodes, visibleSchemas, diff]);

  const visibleEdges = useMemo(() => {
    return edges.map(e => {
      const fk = e.data?.fk;
      if (!fk) return e;
      const hidden = visibleSchemas
        ? !(visibleSchemas.has(fk.schema) && visibleSchemas.has(fk.referencedSchema))
        : false;
      const fkKey = `${fk.schema}.${fk.table}.${fk.constraintName}`;
      const fkStatus = diff
        ? diff.addedForeignKeys.has(fkKey)
          ? ('added' as const)
          : diff.removedForeignKeys.has(fkKey)
            ? ('removed' as const)
            : ('unchanged' as const)
        : undefined;
      const data: SchemaEdge['data'] = fkStatus ? { fk, diff: fkStatus } : { fk };
      return { ...e, hidden, data };
    });
  }, [edges, visibleSchemas, diff]);

  const handleBaselineUpload = (file: File) => {
    setBaselineError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const parsed = sqlMetadataSchema.safeParse(raw);
        if (!parsed.success) {
          setBaselineError(
            lang === 'es'
              ? 'El archivo no parece un metadata JSON válido'
              : 'File is not a valid metadata JSON'
          );
          return;
        }
        setBaselineMetadata(parsed.data);
      } catch {
        setBaselineError(lang === 'es' ? 'JSON inválido' : 'Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${exportBaseName}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const status =
    lang === 'es'
      ? loading
        ? 'Calculando layout…'
        : `${grouped.tables.length} tablas · ${metadata.foreignKeys.length} relaciones`
      : loading
        ? 'Computing layout…'
        : `${grouped.tables.length} tables · ${metadata.foreignKeys.length} relationships`;

  return (
    <div className="relative h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable={false}
        defaultEdgeOptions={{ type: 'schema.fk' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
        <Panel
          position="top-left"
          className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900/95 p-1 shadow-xl backdrop-blur"
        >
          <button
            type="button"
            onClick={() => exportImage('png', `${exportBaseName}.png`)}
            disabled={exporting || loading}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={lang === 'es' ? 'Exportar PNG' : 'Export PNG'}
          >
            {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            <span>PNG</span>
          </button>
          <button
            type="button"
            onClick={() => exportImage('svg', `${exportBaseName}.svg`)}
            disabled={exporting || loading}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={lang === 'es' ? 'Exportar SVG' : 'Export SVG'}
          >
            <FileImage size={11} />
            <span>SVG</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const dbml = exportDbml(grouped, {
                visibleSchemas,
                projectName: metadata.databaseName ?? 'db',
              });
              const blob = new Blob([dbml], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.download = `${exportBaseName}.dbml`;
              link.href = url;
              link.click();
              URL.revokeObjectURL(url);
            }}
            disabled={loading}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={lang === 'es' ? 'Exportar DBML' : 'Export DBML'}
          >
            <FileCode size={11} />
            <span>DBML</span>
          </button>
          <button
            type="button"
            onClick={downloadJson}
            disabled={loading}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={lang === 'es' ? 'Exportar JSON (snapshot)' : 'Export JSON (snapshot)'}
          >
            <Download size={11} />
            <span>JSON</span>
          </button>
          <div className="mx-1 h-4 w-px bg-zinc-700" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            title={lang === 'es' ? 'Comparar contra snapshot' : 'Compare against snapshot'}
          >
            {baselineMetadata ? <GitCompare size={11} /> : <Upload size={11} />}
            <span>{lang === 'es' ? 'Comparar' : 'Compare'}</span>
          </button>
          {baselineMetadata ? (
            <button
              type="button"
              onClick={() => {
                setBaselineMetadata(null);
                setBaselineError(null);
              }}
              className="flex items-center rounded px-1 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-rose-400"
              title={lang === 'es' ? 'Limpiar comparación' : 'Clear comparison'}
            >
              <X size={11} />
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleBaselineUpload(file);
              e.target.value = '';
            }}
          />
        </Panel>
        {diff ? (
          <Panel
            position="top-center"
            className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-1 font-mono text-[10px] uppercase tracking-tight text-zinc-400 shadow-xl backdrop-blur"
          >
            <GitCompare size={11} className="text-amber-400" />
            <span className="text-emerald-400">+{diff.counts.addedTables}t</span>
            <span className="text-rose-400">-{diff.counts.removedTables}t</span>
            <span className="text-amber-400">~{diff.counts.changedTables}t</span>
            <span className="text-zinc-500">·</span>
            <span className="text-emerald-400">+{diff.counts.addedColumns}c</span>
            <span className="text-rose-400">-{diff.counts.removedColumns}c</span>
            <span className="text-amber-400">~{diff.counts.changedColumns}c</span>
            <span className="text-zinc-500">·</span>
            <span className="text-emerald-400">+{diff.counts.addedForeignKeys}fk</span>
            <span className="text-rose-400">-{diff.counts.removedForeignKeys}fk</span>
          </Panel>
        ) : null}
        {baselineError ? (
          <Panel
            position="top-center"
            className="rounded-md border border-rose-700 bg-rose-950/80 px-3 py-1 text-[11px] text-rose-300 shadow-xl backdrop-blur"
          >
            {baselineError}
          </Panel>
        ) : null}
        <Controls
          showInteractive={false}
          className="!border-zinc-700 !bg-zinc-900 [&_button]:!border-zinc-700 [&_button]:!bg-zinc-900 [&_button]:!text-zinc-300"
        />
        <MiniMap
          pannable
          zoomable
          className="!border-zinc-700 !bg-zinc-900"
          nodeColor={n =>
            (n as SchemaNode).data?.table.isView ? 'rgb(99,102,241)' : 'rgb(63,63,70)'
          }
        />
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker
              id="schema-fk-marker"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--rb-edge, #71717a)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-zinc-900/90 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500 backdrop-blur">
        {loading ? <Loader2 size={10} className="mr-1 inline animate-spin" /> : null}
        {status}
      </div>
    </div>
  );
}

const Wrapped = memo(function SchemaDiagram(props: SchemaDiagramProps) {
  return (
    <ReactFlowProvider>
      <SchemaDiagramInner {...props} />
    </ReactFlowProvider>
  );
});

export default Wrapped;
