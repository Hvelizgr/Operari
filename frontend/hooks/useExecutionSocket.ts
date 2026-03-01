import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface LogEntry {
    message: string;
    timestamp: string;
    metadata?: any;
}

export interface NodeStatusUpdate {
    nodeId: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
    result?: any;
    testResults?: any[];
    timestamp: string;
}

export function useExecutionSocket(executionId: string | null) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>>({});
    const [nodeOutputs, setNodeOutputs] = useState<Record<string, any>>({});
    const [nodeTestResults, setNodeTestResults] = useState<Record<string, any[]>>({});
    const [executionStatus, setExecutionStatus] = useState<'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'QUEUED' | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const currentExecutionIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!executionId) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            currentExecutionIdRef.current = null;
            setLogs([]);
            setNodeStatuses({});
            setNodeOutputs({});
            setNodeTestResults({});
            setExecutionStatus(null);
            return;
        }

        if (currentExecutionIdRef.current === executionId && socketRef.current?.connected) {
            return;
        }

        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        currentExecutionIdRef.current = executionId;

        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
        const socket = io(backendUrl, {
            withCredentials: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to execution socket');
            socket.emit('join_execution', executionId);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
        });

        socket.on('log', (log: LogEntry) => {
            setLogs((prev) => [...prev, log]);
        });

        socket.on('node_status', (update: NodeStatusUpdate) => {
            setNodeStatuses((prev) => ({
                ...prev,
                [update.nodeId]: update.status,
            }));

            if (update.result) {
                setNodeOutputs((prev) => ({
                    ...prev,
                    [update.nodeId]: update.result
                }));
            }

            if (update.testResults) {
                setNodeTestResults((prev) => ({
                    ...prev,
                    [update.nodeId]: update.testResults!
                }));
            }
        });

        socket.on('execution_status', (status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'QUEUED') => {
            setExecutionStatus(status);
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
        nodeOutputs,
        nodeTestResults,
        executionStatus,
        clearLogs,
    };
}
