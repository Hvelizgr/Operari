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
    // the canvas stays idle even though the run already finished.
    //
    // For a real run we apply each step's status as soon as the fetch
    // resolves so the canvas reflects what the engine actually did.
    // For a *dry-run* that already completed, we instead replay the
    // step sequence with a small wall-clock delay between each so the
    // operator sees the flow animate node-by-node — otherwise the run
    // is over in 40 ms and the entire graph flashes green at once,
    // which defeats the "watch how this runbook would work" purpose
    // of the Simulación affordance.
    const backfillCtrl = new AbortController();
    let replayTimers: ReturnType<typeof setTimeout>[] = [];

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
              type?: string;
              startedAt?: string;
              completedAt?: string;
              duration?: number | null;
              /** Per-step input captured by the engine — what arrived
               *  from the upstream step (or run trigger). Powers the
               *  Replay-desde-aquí preview panel in the inspect bubble. */
              input?: unknown;
              /** Per-step output captured by the engine. Shape varies
               *  by step type. The inspect panel renders this as JSON. */
              output?: unknown;
              /** Per-step error message when the step failed. */
              error?: string | null;
              /** Tier C edge data — count of failed attempts for this
               *  step during this run. Backend computes from
               *  ExecutionError rows; absent = 0. */
              retries?: number;
            }>;
            status?: BackendStatus;
            dryRun?: boolean;
          } | null
        ) => {
          if (!data?.steps) return;
          const store = useEditorStore.getState();
          // Dry-run replay: only when the run terminated (not in
          // a paused/running state) AND was a dry-run. Real runs
          // and live dry-runs apply immediately so the canvas
          // never lies about the engine's actual state.
          const shouldReplay =
            data.dryRun === true &&
            data.status !== 'RUNNING' &&
            data.status !== 'PAUSED' &&
            data.steps.length > 0;

          if (!shouldReplay) {
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
                // Hand the per-step input + output + error onto the
                // canvas so the inspect panel in BaseStepNode can render
                // them without a second fetch. Undefined when absent —
                // the panel renders only when these are set.
                input: (step as { input?: unknown }).input,
                output: (step as { output?: unknown }).output,
                error: (step as { error?: string | null }).error ?? null,
              });
            }
            // Tier C edge data — populate retries (incoming edges of the
            // step) and items (outgoing edges of Loop steps) from the
            // backfill response. Frontend already renders these chips
            // when present; before this wiring the data fields stayed
            // undefined and the chips never showed.
            const isLoopType = (t: string | undefined) =>
              t === 'Loop' || t === 'Iterator' || t === 'operari.loop';
            const loopCountFor = (step: { type?: string; output?: unknown }): number | null => {
              if (!isLoopType(step.type)) return null;
              const out = step.output;
              if (!out || typeof out !== 'object') return null;
              const count = (out as { count?: unknown }).count;
              if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
                return count;
              }
              const items = (out as { items?: unknown }).items;
              if (Array.isArray(items) && items.length > 0) return items.length;
              return null;
            };

            for (const step of data.steps) {
              const mapped = STATUS_MAP[step.status];
              if (!mapped) continue;
              const retries = step.retries && step.retries > 0 ? step.retries : undefined;
              const loopItems = loopCountFor(step);
              for (const edge of store.edges) {
                const isIncoming = edge.target === step.stepId;
                const isOutgoing = edge.source === step.stepId;
                if (!isIncoming && !isOutgoing) continue;
                const patch: Partial<RfEdgeData> = {};
                if (isIncoming) {
                  const edgeStatus = mapped === 'success' || mapped === 'failed' ? mapped : 'idle';
                  if (edge.data?.status !== edgeStatus) patch.status = edgeStatus;
                  if (retries !== edge.data?.retries) patch.retries = retries;
                }
                if (isOutgoing && loopItems != null && edge.data?.items !== loopItems) {
                  patch.items = loopItems;
                }
                if (Object.keys(patch).length > 0) {
                  store.updateEdgeData(edge.id, patch);
                }
              }
            }
            return;
          }

          // Replay path: paint each step `running` for ~600 ms, then
          // its actual final status. Edges into the step go `running`
          // alongside, then settle to success/failed when the step
          // does. The canvas reads as a real-time animated execution
          // even though the engine is long done.
          //
          // Step timing constants — generous enough that a 5-step
          // graph plays out over ~4 s, fast enough that a 20-step
          // graph isn't a 17 s wait. Tuned by feel; can be exposed
          // as a Visualization preference later if operators want a
          // slower demo cadence.
          //
          // STEP_GAP_MS bumped from 80 → 250 so the success / fail
          // bump on step N has time to finish (~600 ms duration)
          // before step N+1's running animation steals attention.
          // The previous gap left the celebration overlapping the
          // next running state which masked the bump entirely.
          const STEP_DURATION_MS = 600;
          const STEP_GAP_MS = 250;
          const PER_STEP = STEP_DURATION_MS + STEP_GAP_MS;

          // Kick the canvas into trace-dim mode so untouched steps
          // fade while the playback unfolds — same affordance the
          // live run path uses. Cleared once the last step settles.
          store.setTraceMode(true);

          // Alias inside the replay branch so the closures the
          // setTimeouts capture see a non-optional reference. The
          // outer `data?.steps` is already narrowed by the early
          // return above, but TS doesn't propagate that across the
          // setTimeout closures.
          const steps = data.steps;

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const mapped = STATUS_MAP[step.status];
            if (!mapped) continue;

            const startAt = i * PER_STEP;
            const settleAt = startAt + STEP_DURATION_MS;

            // Mark step as running.
            replayTimers.push(
              setTimeout(() => {
                const liveStore = useEditorStore.getState();
                liveStore.updateNodeData(step.stepId, {
                  status: 'running',
                  startedAt: Date.now(),
                  durationMs: null,
                });
                // Incoming edges flip to running so the orb / dash
                // animation reads as data flowing into this step.
                for (const edge of liveStore.edges) {
                  if (edge.target !== step.stepId) continue;
                  if (edge.data?.status !== 'running') {
                    liveStore.updateEdgeData(edge.id, { status: 'running' });
                  }
                }
              }, startAt)
            );

            // Settle step to its final status.
            replayTimers.push(
              setTimeout(() => {
                const liveStore = useEditorStore.getState();
                const node = liveStore.nodes.find(n => n.id === step.stepId);
                const startedAt = node?.data?.startedAt ?? Date.now() - STEP_DURATION_MS;
                liveStore.updateNodeData(step.stepId, {
                  status: mapped,
                  startedAt,
                  durationMs: STEP_DURATION_MS,
                });
                // Incoming edges settle to terminal state.
                const edgeStatus = mapped === 'success' || mapped === 'failed' ? mapped : 'idle';
                for (const edge of liveStore.edges) {
                  if (edge.target !== step.stepId) continue;
                  if (edge.data?.status !== edgeStatus) {
                    liveStore.updateEdgeData(edge.id, { status: edgeStatus });
                  }
                }
                // Last step → drop trace dim so the canvas isn't
                // permanently faded after the playback ends.
                if (i === steps.length - 1) {
                  liveStore.setTraceMode(false);
                }
              }, settleAt)
            );
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
      // Cancel any pending replay-step timers so a fast remount
      // (e.g. operator clicks Simulación again before the previous
      // playback finishes) doesn't keep painting the prior run on
      // top of the new one.
      for (const timer of replayTimers) clearTimeout(timer);
      replayTimers = [];
      socket.off('node_status', applyNodeStatus);
      socket.off('execution_status', handleExecutionStatus);
      socket.emit('leave_execution', executionId);
      socket.disconnect();
    };
  }, [executionId]);
}
