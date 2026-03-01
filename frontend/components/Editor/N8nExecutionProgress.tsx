'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, CheckCircle, XCircle, Loader2, Clock, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface NodeExecutionState {
    nodeId: string;
    nodeName: string;
    status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
    startTime?: number;
    endTime?: number;
    error?: string;
    output?: any;
}

interface N8nExecutionProgressProps {
    isOpen: boolean;
    onClose: () => void;
    executionId?: string;
    nodes: any[];
    onNodeHighlight?: (nodeId: string | null) => void;
    lang: 'en' | 'es';
}

export default function N8nExecutionProgress({
    isOpen,
    onClose,
    executionId,
    nodes,
    onNodeHighlight,
    lang
}: N8nExecutionProgressProps) {
    const [nodeStates, setNodeStates] = useState<NodeExecutionState[]>([]);
    const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [expandedNode, setExpandedNode] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const startTimeRef = useRef<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isOpen && nodes.length > 0) {
            const initialStates: NodeExecutionState[] = nodes.map(node => ({
                nodeId: node.id,
                nodeName: node.title || node.name || 'Node',
                status: 'pending',
            }));
            setNodeStates(initialStates);
            setOverallStatus('running');
            startTimeRef.current = Date.now();
            
            intervalRef.current = setInterval(() => {
                if (startTimeRef.current) {
                    setElapsedTime(Date.now() - startTimeRef.current);
                }
            }, 100);

            simulateExecution(initialStates);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, nodes]);

    const simulateExecution = async (states: NodeExecutionState[]) => {
        for (let i = 0; i < states.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
            
            setNodeStates(prev => {
                const updated = [...prev];
                updated[i] = {
                    ...updated[i],
                    status: 'running',
                    startTime: Date.now(),
                };
                return updated;
            });

            if (onNodeHighlight) {
                onNodeHighlight(states[i].nodeId);
            }

            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));

            const success = Math.random() > 0.1;
            
            setNodeStates(prev => {
                const updated = [...prev];
                updated[i] = {
                    ...updated[i],
                    status: success ? 'success' : 'error',
                    endTime: Date.now(),
                    error: success ? undefined : 'Simulated error for testing',
                    output: success ? { items: Math.floor(Math.random() * 10) + 1 } : undefined,
                };
                return updated;
            });

            if (!success) {
                setOverallStatus('error');
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
                if (onNodeHighlight) {
                    onNodeHighlight(null);
                }
                return;
            }
        }

        setOverallStatus('success');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        if (onNodeHighlight) {
            onNodeHighlight(null);
        }
    };

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
        
        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        }
        return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
    };

    const getStatusIcon = (status: NodeExecutionState['status']) => {
        switch (status) {
            case 'pending':
                return <Clock size={16} className="text-gray-500" />;
            case 'running':
                return <Loader2 size={16} className="text-blue-500 animate-spin" />;
            case 'success':
                return <CheckCircle size={16} className="text-green-500" />;
            case 'error':
                return <XCircle size={16} className="text-red-500" />;
            case 'skipped':
                return <AlertTriangle size={16} className="text-yellow-500" />;
        }
    };

    const getStatusColor = (status: NodeExecutionState['status']) => {
        switch (status) {
            case 'pending':
                return 'bg-gray-500/10 border-gray-500/20';
            case 'running':
                return 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20';
            case 'success':
                return 'bg-green-500/10 border-green-500/20';
            case 'error':
                return 'bg-red-500/10 border-red-500/20';
            case 'skipped':
                return 'bg-yellow-500/10 border-yellow-500/20';
        }
    };

    const completedNodes = nodeStates.filter(n => n.status === 'success' || n.status === 'error').length;
    const progress = nodes.length > 0 ? (completedNodes / nodes.length) * 100 : 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, x: 300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 300 }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                    className="fixed right-4 top-20 w-80 bg-[#0a0a0b] rounded-2xl shadow-2xl border border-white/10 z-40 overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                overallStatus === 'running' ? 'bg-blue-500/20' :
                                overallStatus === 'success' ? 'bg-green-500/20' :
                                overallStatus === 'error' ? 'bg-red-500/20' : 'bg-gray-500/20'
                            }`}>
                                {overallStatus === 'running' ? (
                                    <Loader2 size={16} className="text-blue-500 animate-spin" />
                                ) : overallStatus === 'success' ? (
                                    <CheckCircle size={16} className="text-green-500" />
                                ) : overallStatus === 'error' ? (
                                    <XCircle size={16} className="text-red-500" />
                                ) : (
                                    <Play size={16} className="text-gray-500" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-white">
                                    {lang === 'en' ? 'Execution Progress' : 'Progreso de Ejecución'}
                                </h3>
                                <p className="text-xs text-gray-500">{formatTime(elapsedTime)}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="px-4 py-2 border-b border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-gray-400">
                                {completedNodes} / {nodes.length} {lang === 'en' ? 'nodes' : 'nodos'}
                            </span>
                            <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className={`h-full rounded-full ${
                                    overallStatus === 'error' ? 'bg-red-500' :
                                    overallStatus === 'success' ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                            />
                        </div>
                    </div>

                    {/* Node List */}
                    <div className="max-h-[400px] overflow-y-auto p-2 space-y-1.5">
                        {nodeStates.map((node, index) => (
                            <motion.div
                                key={node.nodeId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <button
                                    onClick={() => {
                                        setExpandedNode(expandedNode === node.nodeId ? null : node.nodeId);
                                        if (onNodeHighlight) {
                                            onNodeHighlight(node.nodeId);
                                        }
                                    }}
                                    className={`w-full p-3 rounded-xl border transition-all text-left ${getStatusColor(node.status)}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {getStatusIcon(node.status)}
                                            <span className="text-sm text-white truncate">{node.nodeName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {node.endTime && node.startTime && (
                                                <span className="text-[10px] text-gray-500">
                                                    {formatTime(node.endTime - node.startTime)}
                                                </span>
                                            )}
                                            {(node.status === 'success' || node.status === 'error') && (
                                                expandedNode === node.nodeId ? (
                                                    <ChevronUp size={14} className="text-gray-500" />
                                                ) : (
                                                    <ChevronDown size={14} className="text-gray-500" />
                                                )
                                            )}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {expandedNode === node.nodeId && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-2 pt-2 border-t border-white/5">
                                                    {node.error ? (
                                                        <p className="text-xs text-red-400">{node.error}</p>
                                                    ) : node.output ? (
                                                        <div className="text-xs text-gray-400">
                                                            <span className="text-green-400">{node.output.items}</span> items
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {/* Footer */}
                    {overallStatus !== 'running' && (
                        <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
                            <button
                                onClick={onClose}
                                className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                                    overallStatus === 'success'
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                            >
                                {overallStatus === 'success'
                                    ? (lang === 'en' ? 'Execution Complete' : 'Ejecución Completada')
                                    : (lang === 'en' ? 'Execution Failed' : 'Ejecución Fallida')}
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
