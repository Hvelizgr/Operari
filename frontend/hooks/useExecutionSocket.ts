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

export function useExecutionSocket(executionId: string | null) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED'>>({});
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!executionId) {
            setLogs([]);
            setNodeStatuses({});
            return;
        }

        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
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
            setNodeStatuses((prev) => ({
                ...prev,
                [update.nodeId]: update.status,
            }));
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

    const clearLogs = () => setLogs([]);

    return {
        logs,
        nodeStatuses,
        clearLogs,
    };
}
