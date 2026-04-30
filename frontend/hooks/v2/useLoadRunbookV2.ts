'use client';

import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';
import { useEffect, useRef } from 'react';

import type { RunbookHeader } from '@/state/editorStoreV2';
import { useEditorStoreV2 } from '@/state/editorStoreV2';
import { specToNodes, yamlToSpec } from '@/utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const headerFromRow = (wf: Record<string, unknown>): RunbookHeader => ({
  name: typeof wf.name === 'string' && wf.name.trim() ? wf.name : 'Untitled',
  ...(typeof wf.slug === 'string' && wf.slug ? { slug: wf.slug } : {}),
  ...(typeof wf.description === 'string' && wf.description ? { description: wf.description } : {}),
  ...(typeof wf.category === 'string' && wf.category ? { category: wf.category } : {}),
  ...(typeof wf.schedule === 'string' && wf.schedule ? { schedule: wf.schedule } : {}),
});

export function useLoadRunbookV2(runbookId: string | null) {
  const hydrateFromWorkflow = useEditorStoreV2(s => s.hydrateFromWorkflow);
  const setStatus = useEditorStoreV2(s => s.setStatus);
  // StrictMode fires effects twice in dev; guard so we don't double-fetch
  // and overwrite local edits. Mirrors the V1 loadedRunbookIdRef pattern.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!runbookId) return;
    if (loadedIdRef.current === runbookId) return;
    loadedIdRef.current = runbookId;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/runbooks/${runbookId}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const wf = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;

        let nodes: WorkflowNode[] = [];
        let connections: WorkflowConnection[] = [];
        if (Array.isArray(wf.nodes) && wf.nodes.length > 0) {
          nodes = wf.nodes as WorkflowNode[];
          connections = Array.isArray(wf.connections)
            ? (wf.connections as WorkflowConnection[])
            : [];
        } else {
          try {
            const yamlRes = await fetch(`${API_BASE}/api/runbooks/${runbookId}/yaml`, {
              credentials: 'include',
            });
            if (yamlRes.ok) {
              const body = await yamlRes.text();
              const parsed = specToNodes(yamlToSpec(body));
              nodes = parsed.nodes;
              connections = parsed.connections;
            }
          } catch {
            // YAML path is best-effort; legacy nodes stay primary.
          }
        }
        if (cancelled) return;
        hydrateFromWorkflow(runbookId, headerFromRow(wf), nodes, connections);
      } catch (err) {
        if (cancelled) return;
        setStatus('error', err instanceof Error ? err.message : 'load failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runbookId, hydrateFromWorkflow, setStatus]);
}
