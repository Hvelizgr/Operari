import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';

export type SaveStatus = 'saving' | 'saved' | 'error' | 'conflict';

interface AutosaveOptions {
    nodes: WorkflowNode[];
    connections: Connection[];
    workflowId: string;
    debounceMs?: number;
}

interface WorkflowData {
    nodes: WorkflowNode[];
    connections: Connection[];
    version: string;
    timestamp: number;
    workflowId: string;
}

export function useAutosave({
    nodes,
    connections,
    workflowId,
    debounceMs = 2000,
}: AutosaveOptions) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [enableAutosave, setEnableAutosave] = useState(true);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedTimestampRef = useRef<number>(0);
    const isSavingRef = useRef(false);

    const saveToLocalStorage = useCallback((data: WorkflowData) => {
        try {
            localStorage.setItem(`nanoflow-workflow-${workflowId}`, JSON.stringify(data));
            localStorage.setItem(`nanoflow-workflow-${workflowId}-timestamp`, data.timestamp.toString());
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }, [workflowId]);

    const saveToBackend = useCallback(async (data: WorkflowData): Promise<boolean> => {
        try {
            const response = await fetch(`/api/runbooks/${workflowId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nodes: data.nodes,
                    connections: data.connections,
                    version: data.version,
                    lastModified: data.timestamp,
                }),
            });

            if (!response.ok) {
                if (response.status === 409) {
                    setSaveStatus('conflict');
                    return false;
                }
                const errorText = await response.text();
                console.error('Backend save failed:', response.status, errorText);
                throw new Error(`Failed to save to backend: ${response.status}`);
            }

            const result = await response.json();
            lastSavedTimestampRef.current = result.timestamp || data.timestamp;
            return true;
        } catch (error) {
            console.error('Backend save error:', error);
            return false;
        }
    }, [workflowId]);

    const checkForConflicts = useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch(`/api/runbooks/${workflowId}/metadata`);

            // If it's the scratchpad and doesn't exist yet, there's no conflict.
            if (response.status === 404 && workflowId === 'current-workflow') {
                return false;
            }

            if (!response.ok) return false;

            const metadata = await response.json();
            const serverTimestamp = metadata.lastModified || 0;

            if (lastSavedTimestampRef.current > 0 && serverTimestamp > lastSavedTimestampRef.current) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Conflict check error:', error);
            // If we can't check for conflicts (e.g. network error), we assume no conflict to try to save
            return false;
        }
    }, [workflowId]);

    const performSave = useCallback(async () => {
        if (isSavingRef.current || !enableAutosave) return;

        isSavingRef.current = true;
        setSaveStatus('saving');

        const workflowData: WorkflowData = {
            nodes,
            connections,
            version: '1.0',
            timestamp: Date.now(),
            workflowId,
        };

        saveToLocalStorage(workflowData);

        if (navigator.onLine) {
            const hasConflict = await checkForConflicts();

            if (hasConflict) {
                setSaveStatus('conflict');
                isSavingRef.current = false;
                return;
            }

            const success = await saveToBackend(workflowData);
            setSaveStatus(success ? 'saved' : 'error');
        } else {
            setSaveStatus('saved');
        }

        isSavingRef.current = false;
    }, [nodes, connections, workflowId, enableAutosave, saveToLocalStorage, saveToBackend, checkForConflicts]);

    useEffect(() => {
        if (!enableAutosave) {
            setSaveStatus('saved');
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            performSave();
        }, debounceMs);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [nodes, connections, enableAutosave, debounceMs, performSave]);

    useEffect(() => {
        const handleOnline = () => {
            if (enableAutosave && saveStatus === 'error') {
                performSave();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [enableAutosave, saveStatus, performSave]);

    useEffect(() => {
        const savedPreference = localStorage.getItem('nanoflow-autosave-enabled');
        if (savedPreference !== null) {
            setEnableAutosave(savedPreference === 'true');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('nanoflow-autosave-enabled', enableAutosave.toString());
    }, [enableAutosave]);

    return {
        saveStatus,
        enableAutosave,
        setEnableAutosave,
    };
}
