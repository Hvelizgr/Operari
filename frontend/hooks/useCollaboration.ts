import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WorkflowNode, Connection } from '@nanoflow/shared';

export interface RemoteUser {
    socketId: string;
    user: any;
    cursor?: { x: number, y: number };
}

interface CollaborationHooks {
    nodes: WorkflowNode[];
    connections: Connection[];
    setNodes: (nodes: WorkflowNode[] | ((prev: WorkflowNode[]) => WorkflowNode[])) => void;
    setConnections: (connections: Connection[] | ((prev: Connection[]) => Connection[])) => void;
}

export function useCollaboration(workflowId: string | null, user: any, { nodes, connections, setNodes, setConnections }: CollaborationHooks) {
    const socketRef = useRef<Socket | null>(null);
    const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUser>>({});
    const isApplyingRemoteRef = useRef(false);

    useEffect(() => {
        if (!workflowId || !user) return;

        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
        const socket = io(backendUrl, {
            withCredentials: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to collaboration socket');
            socket.emit('join_workflow', { workflowId, user });
        });

        socket.on('user_joined', ({ socketId, user: joinedUser }) => {
            setRemoteUsers(prev => ({
                ...prev,
                [socketId]: { socketId, user: joinedUser }
            }));
        });

        socket.on('user_left', ({ socketId }) => {
            setRemoteUsers(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        });

        socket.on('remote_cursor_move', ({ userId, position }) => {
            setRemoteUsers(prev => {
                if (!prev[userId]) return prev;
                return {
                    ...prev,
                    [userId]: { ...prev[userId], cursor: position }
                };
            });
        });

        socket.on('remote_workflow_changes', (data: { senderId: string, changes: any }) => {
            const { changes } = data;
            isApplyingRemoteRef.current = true;
            
            if (changes.nodes) {
                setNodes(changes.nodes);
            }
            if (changes.connections) {
                setConnections(changes.connections);
            }

            // Reset after a short delay to allow state to settle
            setTimeout(() => {
                isApplyingRemoteRef.current = false;
            }, 100);
        });

        return () => {
            if (socket) {
                socket.emit('leave_workflow', workflowId);
                socket.disconnect();
            }
        };
    }, [workflowId, user, setNodes, setConnections]);

    const broadcastChanges = useCallback((changes: { nodes?: WorkflowNode[], connections?: Connection[] }) => {
        if (!socketRef.current || !workflowId || isApplyingRemoteRef.current) return;
        
        socketRef.current.emit('workflow_changes', {
            workflowId,
            changes
        });
    }, [workflowId]);

    const broadcastCursor = useCallback((position: { x: number, y: number }) => {
        if (!socketRef.current || !workflowId) return;
        
        socketRef.current.emit('cursor_move', {
            workflowId,
            position
        });
    }, [workflowId]);

    return {
        remoteUsers: Object.values(remoteUsers),
        broadcastChanges,
        broadcastCursor
    };
}
