import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface LogEntry {
    message: string;
    timestamp: string;
    metadata?: any;
}

export interface NodeStatusUpdate {
    nodeId: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    result?: any;
    timestamp: string;
}

/**
 * Run-level state push from the backend. The execution.service emits
 * this on every phase transition (RUNNING at start, PAUSED on
 * approval gates, SUCCESS / FAILED at the terminal). The dashboard
 * tile and the run-detail header consume it so they don't have to
 * poll the REST endpoint to know "did this finish".
 */
export interface ExecutionStatusUpdate {
    status: 'RUNNING' | 'PAUSED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    timestamp: string;
}

/**
 * Per-node execution metadata derived from node_status events.
 * Tracks start / end timestamps so the canvas card can show a real
 * duration footer ("ran 2.1s" / "running 4s…") instead of just a
 * status pulse.
 */
export interface NodeMeta {
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    startedAt: number | null;
    completedAt: number | null;
    /** Final duration in ms, or live elapsed when still running. */
    durationMs: number | null;
}

export function useExecutionSocket(executionId: string | null) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>>({});
    const [nodeMeta, setNodeMeta] = useState<Record<string, NodeMeta>>({});
    const [executionStatus, setExecutionStatus] = useState<ExecutionStatusUpdate['status'] | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!executionId) {
            setLogs([]);
            setNodeStatuses({});
            setNodeMeta({});
            setExecutionStatus(null);
            return;
        }

        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const socket = io(backendUrl, {
            withCredentials: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to execution socket');
            socket.emit('join_execution', executionId);
        });

        socket.on('log', (log: LogEntry) => {
            setLogs((prev) => [...prev, log]);
        });

        socket.on('node_status', (update: NodeStatusUpdate) => {
            const ts = Date.parse(update.timestamp);
            const evtTime = Number.isFinite(ts) ? ts : Date.now();

            setNodeStatuses((prev) => ({
                ...prev,
                [update.nodeId]: update.status,
            }));

            setNodeMeta((prev) => {
                const existing = prev[update.nodeId];
                if (update.status === 'RUNNING') {
                    return {
                        ...prev,
                        [update.nodeId]: {
                            status: 'RUNNING',
                            startedAt: evtTime,
                            completedAt: null,
                            durationMs: null,
                        },
                    };
                }
                // SUCCESS / FAILED — close the window if we have a start
                const startedAt = existing?.startedAt ?? null;
                return {
                    ...prev,
                    [update.nodeId]: {
                        status: update.status,
                        startedAt,
                        completedAt: evtTime,
                        durationMs:
                            startedAt != null ? Math.max(0, evtTime - startedAt) : null,
                    },
                };
            });
        });

        socket.on('execution_status', (update: ExecutionStatusUpdate) => {
            setExecutionStatus(update.status);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from execution socket');
        });

        return () => {
            if (socket) {
                socket.emit('leave_execution', executionId);
                socket.disconnect();
            }
        };
    }, [executionId]);

    // Live tick: while any node is RUNNING, recompute its elapsed
    // duration once a second so the footer updates without needing
    // a separate timer in every EditorNode. Fires only when there is
    // at least one running node so an idle editor pays nothing.
    useEffect(() => {
        const hasRunning = Object.values(nodeMeta).some((m) => m.status === 'RUNNING');
        if (!hasRunning) return;
        const tick = setInterval(() => {
            setNodeMeta((prev) => {
                const next: Record<string, NodeMeta> = {};
                let changed = false;
                for (const [id, m] of Object.entries(prev)) {
                    if (m.status === 'RUNNING' && m.startedAt != null) {
                        next[id] = { ...m, durationMs: Date.now() - m.startedAt };
                        changed = true;
                    } else {
                        next[id] = m;
                    }
                }
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [nodeMeta]);

    const clearLogs = () => setLogs([]);

    return {
        logs,
        nodeStatuses,
        nodeMeta,
        executionStatus,
        clearLogs,
    };
}
