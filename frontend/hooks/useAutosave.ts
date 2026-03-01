import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export type SaveStatus = 'saving' | 'saved' | 'error' | 'conflict' | 'retrying';

interface AutosaveOptions {
    nodes: WorkflowNode[];
    connections: Connection[];
    workflowId: string;
    debounceMs?: number;
    maxRetries?: number;
}

interface WorkflowData {
    nodes: WorkflowNode[];
    connections: Connection[];
    version: string;
    timestamp: number;
    workflowId: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useAutosave({
    nodes,
    connections,
    workflowId,
    debounceMs = 2000,
    maxRetries = 3,
}: AutosaveOptions) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [enableAutosave, setEnableAutosave] = useState(true);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedTimestampRef = useRef<number>(0);
    const isSavingRef = useRef(false);
    const retryCountRef = useRef(0);
    const pendingDataRef = useRef<WorkflowData | null>(null);

    const saveToLocalStorage = useCallback((data: WorkflowData) => {
        try {
            localStorage.setItem(`nanoflow-workflow-${workflowId}`, JSON.stringify(data));
            localStorage.setItem(`nanoflow-workflow-${workflowId}-timestamp`, data.timestamp.toString());
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }, [workflowId]);

    const saveToBackendWithRetry = useCallback(async (data: WorkflowData, retryCount = 0): Promise<boolean> => {
        try {
            const token = localStorage.getItem('nanoflow_token');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${API_URL}/api/workflows/${workflowId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    nodes: data.nodes,
                    connections: data.connections,
                    version: data.version,
                    lastModified: data.timestamp,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 409) {
                    setSaveStatus('conflict');
                    return false;
                }
                if (response.status >= 500 && retryCount < maxRetries) {
                    setSaveStatus('retrying');
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
                    await sleep(delay);
                    return saveToBackendWithRetry(data, retryCount + 1);
                }
                const errorText = await response.text();
                console.error('Backend save failed:', response.status, errorText);
                throw new Error(`Failed to save to backend: ${response.status}`);
            }

            const result = await response.json();
            lastSavedTimestampRef.current = result.timestamp || data.timestamp;
            retryCountRef.current = 0;
            return true;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.warn('Save request timed out');
            }
            if (retryCount < maxRetries) {
                setSaveStatus('retrying');
                const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
                await sleep(delay);
                return saveToBackendWithRetry(data, retryCount + 1);
            }
            console.error('Backend save error after retries:', error);
            pendingDataRef.current = data;
            return false;
        }
    }, [workflowId, maxRetries]);

    const checkForConflicts = useCallback(async (): Promise<boolean> => {
        try {
            const token = localStorage.getItem('nanoflow_token');
            const response = await fetch(`${API_URL}/api/workflows/${workflowId}/metadata`, {
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                }
            });

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

            const success = await saveToBackendWithRetry(workflowData);
            setSaveStatus(success ? 'saved' : 'error');
        } else {
            pendingDataRef.current = workflowData;
            setSaveStatus('saved');
        }

        isSavingRef.current = false;
    }, [nodes, connections, workflowId, enableAutosave, saveToLocalStorage, saveToBackendWithRetry, checkForConflicts]);

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
            if (pendingDataRef.current) {
                saveToBackendWithRetry(pendingDataRef.current).then(success => {
                    if (success) {
                        pendingDataRef.current = null;
                        setSaveStatus('saved');
                    } else {
                        setSaveStatus('error');
                    }
                });
            } else if (enableAutosave && saveStatus === 'error') {
                performSave();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [enableAutosave, saveStatus, performSave, saveToBackendWithRetry]);

    useEffect(() => {
        const savedPreference = localStorage.getItem('nanoflow-autosave-enabled');
        if (savedPreference !== null) {
            setEnableAutosave(savedPreference === 'true');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('nanoflow-autosave-enabled', enableAutosave.toString());
    }, [enableAutosave]);

    const forceSave = useCallback(async (overriddenNodes?: WorkflowNode[], overriddenConnections?: Connection[]) => {
        if (isSavingRef.current) return;

        isSavingRef.current = true;
        setSaveStatus('saving');

        const workflowData: WorkflowData = {
            nodes: overriddenNodes || nodes,
            connections: overriddenConnections || connections,
            version: '1.0',
            timestamp: Date.now(),
            workflowId,
        };

        saveToLocalStorage(workflowData);

        if (navigator.onLine) {
            const success = await saveToBackendWithRetry(workflowData);
            setSaveStatus(success ? 'saved' : 'error');
            isSavingRef.current = false;
            return success;
        } else {
            pendingDataRef.current = workflowData;
            setSaveStatus('saved');
            isSavingRef.current = false;
            return true;
        }
    }, [nodes, connections, workflowId, saveToLocalStorage, saveToBackendWithRetry]);

    const recoverFromLocalStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem(`nanoflow-workflow-${workflowId}`);
            if (saved) {
                return JSON.parse(saved) as WorkflowData;
            }
        } catch (error) {
            console.error('Failed to recover from localStorage:', error);
        }
        return null;
    }, [workflowId]);

    return {
        saveStatus,
        enableAutosave,
        setEnableAutosave,
        forceSave,
        recoverFromLocalStorage,
    };
}
