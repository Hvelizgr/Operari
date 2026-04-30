'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { RfEdgeData, RfNodeData } from '@/lib/canvas/v2/adapter';
import { useEditorStoreV2 } from '@/state/editorStoreV2';

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

export function useExecutionSocketV2(executionId: string | null) {
  useEffect(() => {
    if (!executionId) return;

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
      const store = useEditorStoreV2.getState();
      const node = store.nodes.find(n => n.id === event.nodeId);
      if (!node) return;

      store.updateNodeData(event.nodeId, { status: mapped });

      // Edge status propagation: an edge into this node mirrors the
      // node's status so the orb / dash kicks in as soon as the step
      // starts running. Outgoing edges are recomputed when the
      // downstream node's status arrives.
      const edgeStatus: NonNullable<RfEdgeData['status']> =
        mapped === 'running' ? 'running' : 'idle';
      for (const edge of store.edges) {
        if (edge.target !== event.nodeId) continue;
        if ((edge.data?.status ?? 'idle') === edgeStatus) continue;
        store.updateEdgeData(edge.id, { status: edgeStatus });
      }
    };

    const handleExecutionStatus = (event: ExecutionStatusEvent) => {
      // When the run terminates, clear `running` flags so the canvas
      // returns to a static state instead of leaving an orb stuck on
      // the last in-flight edge.
      if (event.status === 'RUNNING' || event.status === 'PAUSED') return;
      const store = useEditorStoreV2.getState();
      for (const node of store.nodes) {
        if (node.data.status === 'running') {
          store.updateNodeData(node.id, { status: 'idle' });
        }
      }
      for (const edge of store.edges) {
        if (edge.data?.status === 'running') {
          store.updateEdgeData(edge.id, { status: 'idle' });
        }
      }
    };

    socket.on('node_status', applyNodeStatus);
    socket.on('execution_status', handleExecutionStatus);

    return () => {
      socket.off('node_status', applyNodeStatus);
      socket.off('execution_status', handleExecutionStatus);
      socket.emit('leave_execution', executionId);
      socket.disconnect();
    };
  }, [executionId]);
}
