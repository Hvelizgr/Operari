
import { useState, useCallback, useEffect } from 'react';
import { WorkflowNode, Connection } from '@nanoflow/shared';

export interface Snapshot {
    id: string;
    timestamp: number;
    name: string;
    nodes: WorkflowNode[];
    connections: Connection[];
    description?: string;
}

const MAX_SNAPSHOTS = 20;
const STORAGE_KEY_PREFIX = 'nanoflow-snapshot-';

export function useSnapshots(workflowId: string = 'global') {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

    // Load snapshots from local storage on mount
    useEffect(() => {
        const key = `${STORAGE_KEY_PREFIX}${workflowId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setSnapshots(parsed);
            } catch (e) {
                console.error('Failed to parse snapshots', e);
            }
        }
    }, [workflowId]);

    // Save snapshots to local storage whenever they change
    useEffect(() => {
        const key = `${STORAGE_KEY_PREFIX}${workflowId}`;
        localStorage.setItem(key, JSON.stringify(snapshots));
    }, [snapshots, workflowId]);

    const createSnapshot = useCallback((
        nodes: WorkflowNode[],
        connections: Connection[],
        name?: string
    ) => {
        const newSnapshot: Snapshot = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            name: name || `Snapshot ${new Date().toLocaleTimeString()}`,
            nodes: JSON.parse(JSON.stringify(nodes)), // Deep copy to avoid reference issues
            connections: JSON.parse(JSON.stringify(connections)),
        };

        setSnapshots(prev => {
            const updated = [newSnapshot, ...prev];
            return updated.slice(0, MAX_SNAPSHOTS); // Keep only last N
        });

        return newSnapshot.id;
    }, []);

    const restoreSnapshot = useCallback((snapshotId: string) => {
        const snapshot = snapshots.find(s => s.id === snapshotId);
        if (!snapshot) return null;
        return { nodes: snapshot.nodes, connections: snapshot.connections };
    }, [snapshots]);

    const deleteSnapshot = useCallback((snapshotId: string) => {
        setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    }, []);

    const clearSnapshots = useCallback(() => {
        setSnapshots([]);
    }, []);

    return {
        snapshots,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        clearSnapshots
    };
}
