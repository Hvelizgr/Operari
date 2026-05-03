'use client';

import type { Connection as WorkflowConnection, WorkflowNode } from '@operari/shared';
import { useEffect, useRef } from 'react';

import { useEditorStore } from '@/state/editorStore';
import { useEditorPrefs } from '@/lib/userPrefs';
import { nodesToSpec, specToYaml } from '@/utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DEFAULT_DEBOUNCE_MS = 1000;
const LOCAL_KEY = (id: string) => `operari-workflow-${id}`;
const LOCAL_TS_KEY = (id: string) => `operari-workflow-${id}-timestamp`;

const writeLocalFallback = (
  runbookId: string,
  payload: { nodes: WorkflowNode[]; connections: WorkflowConnection[] }
): void => {
  try {
    localStorage.setItem(
      LOCAL_KEY(runbookId),
      JSON.stringify({
        nodes: payload.nodes,
        connections: payload.connections,
        version: '2',
        lastModified: Date.now(),
      })
    );
    localStorage.setItem(LOCAL_TS_KEY(runbookId), String(Date.now()));
  } catch {
    // Quota or unavailable storage — best-effort.
  }
};

const tryYamlSave = async (
  runbookId: string,
  header: { name: string },
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): Promise<boolean> => {
  try {
    const spec = nodesToSpec(header, nodes, connections);
    const yaml = specToYaml(spec);
    const res = await fetch(`${API_BASE}/api/runbooks/${runbookId}/yaml`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

const tryJsonSave = async (
  runbookId: string,
  payload: { nodes: WorkflowNode[]; connections: WorkflowConnection[] },
  breakpoints: string[]
): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/api/runbooks/${runbookId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: payload.nodes,
        connections: payload.connections,
        breakpoints,
        lastModified: Date.now(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

const checkConflict = async (runbookId: string, localSavedAt: number | null): Promise<boolean> => {
  if (localSavedAt == null) return false;
  try {
    const res = await fetch(`${API_BASE}/api/runbooks/${runbookId}/metadata`, {
      credentials: 'include',
    });
    if (!res.ok) return false;
    const meta = (await res.json()) as { lastModified?: number | string };
    if (meta.lastModified == null) return false;
    const remote =
      typeof meta.lastModified === 'number'
        ? meta.lastModified
        : Date.parse(String(meta.lastModified));
    return Number.isFinite(remote) && remote > localSavedAt;
  } catch {
    return false;
  }
};

export function useAutosave() {
  const runbookId = useEditorStore(s => s.runbookId);
  const status = useEditorStore(s => s.status);
  const [editorPrefs] = useEditorPrefs();
  const debounceMs = editorPrefs.autosaveIntervalMs || DEFAULT_DEBOUNCE_MS;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!runbookId) return;
    if (status !== 'dirty') return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const store = useEditorStore.getState();
      if (store.runbookId !== runbookId || store.status !== 'dirty') return;

      const conflict = await checkConflict(runbookId, store.savedAt);
      if (conflict) {
        store.setStatus(
          'conflict',
          'Remote runbook was modified after you loaded it — refresh to merge.'
        );
        return;
      }

      const payload = store.getRunbookPayload();
      const header = store.runbookHeader;
      const breakpoints = store.breakpoints;
      store.setStatus('saving');

      // YAML path drops breakpoints — they're not part of the spec
      // schema. So whenever the operator has any breakpoint set we
      // skip YAML and go straight to JSON, which carries the field.
      // YAML stays the optimal save path for runbooks without
      // breakpoints (round-trips comments + ordering).
      let ok = false;
      if (header && breakpoints.length === 0) {
        ok = await tryYamlSave(runbookId, header, payload.nodes, payload.connections);
      }
      if (!ok) ok = await tryJsonSave(runbookId, payload, breakpoints);

      if (ok) {
        store.markSaved();
      } else {
        writeLocalFallback(runbookId, payload);
        store.setStatus('error', 'Save failed; kept a local copy. Will retry on the next change.');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [runbookId, status, debounceMs]);
}
