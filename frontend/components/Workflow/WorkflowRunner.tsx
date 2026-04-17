'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

import { WorkflowNode } from '../Editor';

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
        setLogs((prev) => [
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
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) continue;

            onExecutionStateChange(nodes.map(n => n.id === nodeId ? { ...n, executionState: 'running' as const } : n));
            addLog({
                nodeId,
                nodeName: node.title,
                status: 'running',
                message: `Executing ${node.title}...`,
            });

            await new Promise((resolve) => setTimeout(resolve, 1500));

            const success = Math.random() > 0.15;

            if (success) {
                onExecutionStateChange(nodes.map(n => n.id === nodeId ? { ...n, executionState: 'success' as const } : n));
                addLog({
                    nodeId,
                    nodeName: node.title,
                    status: 'success',
                    message: `${node.title} completed successfully`,
                });
            } else {
                onExecutionStateChange(nodes.map(n => n.id === nodeId ? { ...n, executionState: 'error' as const } : n));
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
            <div className="absolute top-4 left-4 flex items-center gap-3 z-40">
                {!isRunning ? (
                    <button
                        onClick={executeWorkflow}
                        disabled={nodes.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-lg"
                    >
                        <Play size={16} />
                        {text.run}
                    </button>
                ) : (
                    <button
                        onClick={stopExecution}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors shadow-lg"
                    >
                        <Square size={16} />
                        {text.stop}
                    </button>
                )}

                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors shadow-lg border border-slate-700"
                >
                    {text.logs} ({logs.length})
                </button>
            </div>

            <AnimatePresence>
                {showLogs && (
                    <motion.div
                        className="absolute top-20 left-4 w-96 max-h-[500px] bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl z-40 overflow-hidden flex flex-col"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-700">
                            <h3 className="font-semibold text-slate-100">{text.logs}</h3>
                            <button
                                onClick={clearLogs}
                                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                {text.clear}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">{text.noLogs}</p>
                            ) : (
                                logs.map((log) => (
                                    <motion.div
                                        key={log.id}
                                        className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg"
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        {log.status === 'running' && (
                                            <Loader2 size={16} className="text-primary animate-spin flex-shrink-0 mt-0.5" />
                                        )}
                                        {log.status === 'success' && (
                                            <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                                        )}
                                        {log.status === 'error' && (
                                            <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <ChevronRight size={12} className="text-slate-500" />
                                                <span className="text-xs font-medium text-slate-300">{log.nodeName}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">{log.message}</p>
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

    nodes.forEach((node) => {
        inDegree[node.id] = 0;
        graph[node.id] = [];
    });

    connections.forEach((conn) => {
        graph[conn.source].push(conn.target);
        inDegree[conn.target] = (inDegree[conn.target] || 0) + 1;
    });

    const queue: string[] = [];
    Object.keys(inDegree).forEach((nodeId) => {
        if (inDegree[nodeId] === 0) {
            queue.push(nodeId);
        }
    });

    const result: string[] = [];
    while (queue.length > 0) {
        const current = queue.shift()!;
        result.push(current);

        graph[current].forEach((neighbor) => {
            inDegree[neighbor]--;
            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
            }
        });
    }

    return result;
}
