'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { RfEdgeData, RfNodeData } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

type BackendStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED' | 'CANCELLED';
type CanvasStatus = NonNullable<RfNodeData['status']>;

const STATUS_MAP: Record<BackendStatus, CanvasStatus> = {
  RUNNING: 'running',
  PAUSED: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'failed',
  SKIPPED: 'skipped',
};

interface NodeStatusEvent {
  nodeId: string;
  status: BackendStatus;
  result?: unknown;
  timestamp: string;
}

interface ExecutionStatusEvent {
  status: 'RUNNING' | 'PAUSED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useExecutionSocket(executionId: string | null) {
  useEffect(() => {
    if (!executionId) return;

    // Backfill on mount. Dry-runs against a small runbook complete in
    // ~50ms — faster than the Socket.io client can connect, join the
    // execution room, and start receiving events. Without this fetch
    // the canvas stays idle even though the run already finished, and
    // the operator sees "como si iniciara y al momento termina".
    //
    // GET /api/runs/:id returns the persisted Execution + per-step
    // nodeLogs (which write through unconditionally — not gated by
    // OPERARI_DURABLE_ENGINE). We map each step's status into the
    // editor store so the canvas paints the final state immediately,
    // then the live socket subscription catches any subsequent
    // updates (replay, resume, cancel) that arrive after.
    const backfillCtrl = new AbortController();
    fetch(`${API_BASE}/api/runs/${executionId}`, {
      credentials: 'include',
      signal: backfillCtrl.signal,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            steps?: Array<{
              stepId: string;
              status: BackendStatus;
              startedAt?: string;
              completedAt?: string;
              duration?: number | null;
            }>;
            status?: BackendStatus;
          } | null
        ) => {
          if (!data?.steps) return;
          const store = useEditorStore.getState();
          for (const step of data.steps) {
            const mapped = STATUS_MAP[step.status];
            if (!mapped) continue;
            const startedAt = step.startedAt ? Date.parse(step.startedAt) : null;
            store.updateNodeData(step.stepId, {
              status: mapped,
              startedAt: Number.isFinite(startedAt) ? startedAt : null,
              durationMs:
                step.duration ??
                (startedAt != null && step.completedAt
                  ? Math.max(0, Date.parse(step.completedAt) - startedAt)
                  : null),
            });
          }
          // Edge propagation: paint incoming edges of every executed step
          // so the path that fired is visible. Skipped steps fade via
          // existing logic; success/failed/idle leaves edges idle.
          for (const step of data.steps) {
            const mapped = STATUS_MAP[step.status];
            if (!mapped) continue;
            for (const edge of store.edges) {
              if (edge.target !== step.stepId) continue;
              const edgeStatus = mapped === 'success' || mapped === 'failed' ? mapped : 'idle';
              if (edge.data?.status !== edgeStatus) {
                store.updateEdgeData(edge.id, { status: edgeStatus });
              }
            }
          }
        }
      )
      .catch(err => {
        // AbortError on unmount is normal; anything else swallows so
        // a backfill failure never blocks the live socket below.
        if (err?.name !== 'AbortError') {
          console.warn('[useExecutionSocket] backfill failed', err);
        }
      });

    const socket: Socket = io(API_BASE, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const join = () => socket.emit('join_execution', executionId);
    socket.on('connect', join);
    socket.on('reconnect', join);

    const applyNodeStatus = (event: NodeStatusEvent) => {
      const mapped = STATUS_MAP[event.status];
      const store = useEditorStore.getState();
      const node = store.nodes.find(n => n.id === event.nodeId);
      if (!node) return;
      // First running event during this run kicks the canvas into
      // trace mode so untouched steps dim while the run unfolds.
      if (mapped === 'running' && !store.traceMode) store.setTraceMode(true);

      // Track timing so the duration footer can show "ran 2.1s" or
      // "running 4s…". Wall-clock from `event.timestamp` if parseable,
      // else `Date.now()` so a malformed event doesn't break the UI.
      const eventTime = Date.parse(event.timestamp);
      const ts = Number.isFinite(eventTime) ? eventTime : Date.now();
      const prev = node.data;
      let timing: Pick<typeof prev, 'startedAt' | 'durationMs'> | undefined;
      if (mapped === 'running') {
        timing = { startedAt: ts, durationMs: null };
      } else if (mapped === 'success' || mapped === 'failed' || mapped === 'skipped') {
        const startedAt = prev?.startedAt ?? null;
        timing = {
          startedAt,
          durationMs: startedAt != null ? Math.max(0, ts - startedAt) : null,
        };
      }

      store.updateNodeData(event.nodeId, { status: mapped, ...(timing ?? {}) });

      // Edge status propagation has two layers:
      //   1. Incoming edges mirror the *target* node's status so the
      //      orb / dash kicks in as soon as a step starts running.
      //   2. Outgoing edges of a running step go to `yet-to-run`
      //      (chaiNNer-style) so the operator sees what's queued
      //      next — but only if the downstream step itself is still
      //      idle. If the downstream is already running the existing
      //      `running` state on its incoming edge wins.
      const incomingStatus: NonNullable<RfEdgeData['status']> =
        mapped === 'running' ? 'running' : 'idle';
      for (const edge of store.edges) {
        if (edge.target !== event.nodeId) continue;
        if ((edge.data?.status ?? 'idle') === incomingStatus) continue;
        store.updateEdgeData(edge.id, { status: incomingStatus });
      }
      if (mapped === 'running') {
        for (const edge of store.edges) {
          if (edge.source !== event.nodeId) continue;
          const target = store.nodes.find(n => n.id === edge.target);
          const targetStatus = target?.data.status ?? 'idle';
          // Only mark as yet-to-run when the downstream is still idle;
          // a running downstream already paints its own incoming edge.
          if (targetStatus === 'idle' && edge.data?.status !== 'yet-to-run') {
            store.updateEdgeData(edge.id, { status: 'yet-to-run' });
          }
        }
      }
    };

    const handleExecutionStatus = (event: ExecutionStatusEvent) => {
      // When the run terminates, clear `running` flags so the canvas
      // returns to a static state instead of leaving an orb stuck on
      // the last in-flight edge. Also drops the trace dim so the
      // operator can keep editing without the post-run nodes feeling
      // grayed-out.
      if (event.status === 'RUNNING' || event.status === 'PAUSED') return;
      const store = useEditorStore.getState();
      for (const node of store.nodes) {
        if (node.data.status === 'running') {
          store.updateNodeData(node.id, { status: 'idle' });
        }
      }
      for (const edge of store.edges) {
        if (edge.data?.status === 'running' || edge.data?.status === 'yet-to-run') {
          store.updateEdgeData(edge.id, { status: 'idle' });
        }
      }
      store.setTraceMode(false);
    };

    socket.on('node_status', applyNodeStatus);
    socket.on('execution_status', handleExecutionStatus);

    return () => {
      backfillCtrl.abort();
      socket.off('node_status', applyNodeStatus);
      socket.off('execution_status', handleExecutionStatus);
      socket.emit('leave_execution', executionId);
      socket.disconnect();
    };
  }, [executionId]);
}
