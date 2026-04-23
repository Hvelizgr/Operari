import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkflowNode, Connection } from '@cairn/shared';
import {
  nodesToSpec,
  specToYaml,
  RunbookYamlError,
  type RunbookHeader,
} from '../utils/runbookYaml';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type SaveStatus = 'saving' | 'saved' | 'error' | 'conflict';

interface AutosaveOptions {
  nodes: WorkflowNode[];
  connections: Connection[];
  workflowId: string;
  /** When provided, autosave will first attempt the canonical YAML
   * round-trip via PUT /api/runbooks/:id/yaml and only fall back to
   * the legacy nodes/connections PUT if the YAML serialization or
   * the YAML endpoint fails. Without it, autosave behaves exactly
   * like the legacy implementation. */
  runbookHeader?: RunbookHeader;
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
  runbookHeader,
  debounceMs = 2000,
}: AutosaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [enableAutosave, setEnableAutosave] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTimestampRef = useRef<number>(0);
  const isSavingRef = useRef(false);

  const saveToLocalStorage = useCallback(
    (data: WorkflowData) => {
      try {
        localStorage.setItem(`nanoflow-workflow-${workflowId}`, JSON.stringify(data));
        localStorage.setItem(
          `nanoflow-workflow-${workflowId}-timestamp`,
          data.timestamp.toString()
        );
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    },
    [workflowId]
  );

  /**
   * Try the canonical YAML save path first. Returns true on success,
   * false if it should fall back to the legacy nodes/connections
   * save (because nodesToSpec failed, or the YAML endpoint rejected
   * the body, or the network call errored).
   */
  const saveYamlToBackend = useCallback(
    async (data: WorkflowData): Promise<boolean> => {
      if (!runbookHeader) return false;
      try {
        const spec = nodesToSpec(runbookHeader, data.nodes, data.connections);
        const yamlBody = specToYaml(spec);
        const response = await fetch(`${API_BASE}/api/runbooks/${workflowId}/yaml`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yaml: yamlBody }),
        });
        if (!response.ok) {
          // 4xx is a real spec error — let it surface to the user
          // (as a generic save error). 5xx might be transient.
          console.warn('YAML save failed, will fall back to legacy', response.status);
          return false;
        }
        return true;
      } catch (err) {
        if (err instanceof RunbookYamlError) {
          console.warn('YAML serialization failed, falling back to legacy save:', err.message);
        } else {
          console.warn('YAML save error, falling back to legacy:', err);
        }
        return false;
      }
    },
    [runbookHeader, workflowId]
  );

  const saveToBackend = useCallback(
    async (data: WorkflowData): Promise<boolean> => {
      // Try YAML first when a header is available — that path keeps
      // the canonical RunbookSpec in sync on every save, so the YAML
      // round-trip endpoint and any CLI/git consumer always sees a
      // current snapshot. If it fails for any reason we fall through
      // to the legacy nodes/connections save so we never lose data.
      const yamlOk = await saveYamlToBackend(data);
      if (yamlOk) {
        lastSavedTimestampRef.current = data.timestamp;
        return true;
      }

      try {
        const response = await fetch(`${API_BASE}/api/runbooks/${workflowId}`, {
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
    },
    [workflowId, saveYamlToBackend]
  );

  const checkForConflicts = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/runbooks/${workflowId}/metadata`);

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
  }, [
    nodes,
    connections,
    workflowId,
    enableAutosave,
    saveToLocalStorage,
    saveToBackend,
    checkForConflicts,
  ]);

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

  /**
   * Force-save current state, ignoring any conflict. Called by the UI
   * when the user explicitly chooses "overwrite server version" after
   * a conflict is detected. Resets the conflict status so autosave
   * resumes normally.
   */
  const forceOverwrite = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaveStatus('saving');

    // Reset the timestamp so the conflict check won't fire again
    lastSavedTimestampRef.current = 0;

    const workflowData: WorkflowData = {
      nodes,
      connections,
      version: '1.0',
      timestamp: Date.now(),
      workflowId,
    };

    saveToLocalStorage(workflowData);

    const success = await saveToBackend(workflowData);
    setSaveStatus(success ? 'saved' : 'error');
    isSavingRef.current = false;
  }, [nodes, connections, workflowId, saveToLocalStorage, saveToBackend]);

  /**
   * Discard local changes and reload from server. Called when the
   * user chooses "use server version" after a conflict.
   */
  const discardLocal = useCallback(() => {
    setSaveStatus('saved');
    lastSavedTimestampRef.current = 0;
    // The caller (EditorCanvas) should re-fetch the workflow
  }, []);

  return {
    saveStatus,
    enableAutosave,
    setEnableAutosave,
    forceOverwrite,
    discardLocal,
  };
}
