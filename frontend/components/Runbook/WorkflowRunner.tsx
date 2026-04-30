'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Loader2, Play, Square, XCircle } from 'lucide-react';
import { useCallback, useState } from 'react';

import { WorkflowNode } from '@operari/shared';

export type NodeExecutionState = 'idle' | 'running' | 'success' | 'error';

export interface ExecutionLog {
  id: string;
  nodeId: string;
  nodeName: string;
  status: 'running' | 'success' | 'error';
  message: string;
  timestamp: number;
}

interface WorkflowRunnerProps {
  nodes: WorkflowNode[];
  connections: Array<{ source: string; target: string }>;
  onExecutionStateChange: (nodes: WorkflowNode[]) => void;
  lang: 'en' | 'es';
}

export default function WorkflowRunner({
  nodes,
  connections,
  onExecutionStateChange,
  lang,
}: WorkflowRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const content = {
    en: {
      run: 'Run runbook',
      stop: 'Stop',
      logs: 'Run logs',
      noLogs: 'No run logs yet',
      clear: 'Clear',
      running: 'Running',
      success: 'Success',
      error: 'Error',
    },
    es: {
      run: 'Ejecutar runbook',
      stop: 'Detener',
      logs: 'Logs de Ejecución',
      noLogs: 'No hay logs de ejecución',
      clear: 'Limpiar',
      running: 'Ejecutando',
      success: 'Éxito',
      error: 'Error',
    },
  };

  const text = content[lang] || content['en'];

  const addLog = useCallback((log: Omit<ExecutionLog, 'id' | 'timestamp'>) => {
    setLogs(prev => [
      ...prev,
      {
        ...log,
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const executeWorkflow = useCallback(async () => {
    if (nodes.length === 0) return;

    setIsRunning(true);
    setShowLogs(true);
    setLogs([]);

    const executionOrder = buildExecutionOrder(nodes, connections);

    for (const nodeId of executionOrder) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      onExecutionStateChange(
        nodes.map(n => (n.id === nodeId ? { ...n, executionState: 'running' as const } : n))
      );
      addLog({
        nodeId,
        nodeName: node.title,
        status: 'running',
        message: `Executing ${node.title}...`,
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const success = Math.random() > 0.15;

      if (success) {
        onExecutionStateChange(
          nodes.map(n => (n.id === nodeId ? { ...n, executionState: 'success' as const } : n))
        );
        addLog({
          nodeId,
          nodeName: node.title,
          status: 'success',
          message: `${node.title} completed successfully`,
        });
      } else {
        onExecutionStateChange(
          nodes.map(n => (n.id === nodeId ? { ...n, executionState: 'error' as const } : n))
        );
        addLog({
          nodeId,
          nodeName: node.title,
          status: 'error',
          message: `${node.title} failed: Connection timeout`,
        });
        break;
      }
    }

    setIsRunning(false);
  }, [nodes, connections, onExecutionStateChange, addLog]);

  const stopExecution = useCallback(() => {
    setIsRunning(false);
    onExecutionStateChange(nodes.map(n => ({ ...n, executionState: 'idle' as const })));
  }, [nodes, onExecutionStateChange]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <>
      <div className="absolute left-4 top-4 z-40 flex items-center gap-3">
        {!isRunning ? (
          <button
            onClick={executeWorkflow}
            disabled={nodes.length === 0}
            className="bg-primary hover:bg-primary flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            <Play size={16} />
            {text.run}
          </button>
        ) : (
          <button
            onClick={stopExecution}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white shadow-lg transition-colors hover:bg-red-500"
          >
            <Square size={16} />
            {text.stop}
          </button>
        )}

        <button
          onClick={() => setShowLogs(!showLogs)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
        >
          {text.logs} ({logs.length})
        </button>
      </div>

      <AnimatePresence>
        {showLogs && (
          <motion.div
            className="absolute left-4 top-20 z-40 flex max-h-[500px] w-96 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-sm"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h3 className="font-semibold text-slate-100">{text.logs}</h3>
              <button
                onClick={clearLogs}
                className="text-xs text-slate-400 transition-colors hover:text-slate-200"
              >
                {text.clear}
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {logs.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">{text.noLogs}</p>
              ) : (
                logs.map(log => (
                  <motion.div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg bg-slate-800/50 p-3"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {log.status === 'running' && (
                      <Loader2
                        size={16}
                        className="text-primary mt-0.5 flex-shrink-0 animate-spin"
                      />
                    )}
                    {log.status === 'success' && (
                      <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-green-500" />
                    )}
                    {log.status === 'error' && (
                      <XCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ChevronRight size={12} className="text-slate-500" />
                        <span className="text-xs font-medium text-slate-300">{log.nodeName}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{log.message}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function buildExecutionOrder(
  nodes: Array<{ id: string }>,
  connections: Array<{ source: string; target: string }>
): string[] {
  const inDegree: Record<string, number> = {};
  const graph: Record<string, string[]> = {};

  nodes.forEach(node => {
    inDegree[node.id] = 0;
    graph[node.id] = [];
  });

  connections.forEach(conn => {
    graph[conn.source].push(conn.target);
    inDegree[conn.target] = (inDegree[conn.target] || 0) + 1;
  });

  const queue: string[] = [];
  Object.keys(inDegree).forEach(nodeId => {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
    }
  });

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    graph[current].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    });
  }

  return result;
}
