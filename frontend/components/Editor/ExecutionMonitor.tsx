'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, XCircle, Clock, Loader2, Play, Square, RefreshCw, ChevronDown, ChevronRight, Sparkles, BrainCircuit, Check, Copy, ExternalLink, AlertTriangle, Zap } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface NodeResult {
    status: 'success' | 'error' | 'running' | 'waiting';
    output?: any;
    error?: string;
    startedAt?: string;
    finishedAt?: string;
}

interface AIExplanation {
    explanation: string;
    possibleCauses: string[];
    suggestedFixes: Array<{
        title: string;
        description: string;
        code?: string;
        priority: 'high' | 'medium' | 'low';
    }>;
    relatedErrors: string[];
    documentation?: string;
}

interface ExecutionMonitorProps {
    executionId: string | null;
    status?: string;
    nodeStatuses: Record<string, 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'SKIPPED'>;
    nodeOutputs: Record<string, any>;
    nodeTestResults?: Record<string, any[]>;
    nodes: any[];
    onCancel?: () => void;
    onResume?: (input?: any) => void;
    lang: 'en' | 'es';
}

const translations = {
    en: {
        title: 'Execution Monitor',
        noExecution: 'No active execution',
        running: 'Running',
        paused: 'Paused',
        success: 'Success',
        failed: 'Failed',
        waiting: 'Waiting',
        skipped: 'Skipped',
        cancel: 'Cancel',
        resume: 'Continue',
        output: 'Output',
        error: 'Error',
        duration: 'Duration',
        nodeProgress: 'Node Progress',
        executionDetails: 'Execution Details',
        refresh: 'Refresh',
        viewOutput: 'View Output',
        tests: 'Automated Tests',
        testPassed: 'Passed',
        testFailed: 'Failed',
        explainWithAI: 'Explain with AI',
        explaining: 'Analyzing error...',
        aiExplanation: 'AI Diagnosis',
        possibleCauses: 'Possible Causes',
        suggestedFixes: 'Suggested Fixes',
        copyCode: 'Copy Code',
        viewDocs: 'View Documentation',
    },
    es: {
        title: 'Monitor de Ejecución',
        noExecution: 'Sin ejecución activa',
        running: 'Ejecutando',
        paused: 'Pausado',
        success: 'Éxito',
        failed: 'Fallido',
        waiting: 'Esperando',
        skipped: 'Omitido',
        cancel: 'Cancelar',
        resume: 'Continuar',
        output: 'Salida',
        error: 'Error',
        duration: 'Duración',
        nodeProgress: 'Progreso de Nodos',
        executionDetails: 'Detalles de Ejecución',
        refresh: 'Actualizar',
        viewOutput: 'Ver Salida',
        tests: 'Pruebas Automatizadas',
        testPassed: 'Aprobado',
        testFailed: 'Fallido',
        explainWithAI: 'Explicar con IA',
        explaining: 'Analizando error...',
        aiExplanation: 'Diagnóstico IA',
        possibleCauses: 'Posibles Causas',
        suggestedFixes: 'Arreglos Sugeridos',
        copyCode: 'Copiar Código',
        viewDocs: 'Ver Documentación',
    },
};

export default function ExecutionMonitor({
    executionId,
    status: executionStatus,
    nodeStatuses,
    nodeOutputs,
    nodeTestResults = {},
    nodes,
    onCancel,
    onResume,
    lang,
}: ExecutionMonitorProps) {
    const t = translations[lang];
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [executionDetails, setExecutionDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [explainingNode, setExplainingNode] = useState<string | null>(null);
    const [nodeExplanations, setNodeExplanations] = useState<Record<string, AIExplanation>>({});
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const isPaused = executionStatus === 'PAUSED';

    useEffect(() => {
        if (executionId) {
            fetchExecutionDetails();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [executionId]);

    const fetchExecutionDetails = async () => {
        if (!executionId) return;
        setLoading(true);
        try {
            const data = await apiFetch(`/api/n8n/executions/${executionId}`);
            setExecutionDetails(data.data);
        } catch (err) {
            console.error('Failed to fetch execution details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExplainError = async (nodeId: string, node: any, errorData: any) => {
        setExplainingNode(nodeId);
        try {
            const errorMessage = typeof errorData === 'string' ? errorData : (errorData.message || JSON.stringify(errorData));
            const data = await apiFetch('/api/ai/explain-error', {
                method: 'POST',
                body: JSON.stringify({
                    errorMessage,
                    context: {
                        nodeType: node.type,
                        nodeTitle: node.title,
                        nodeConfig: node.config,
                    },
                    lang
                })
            });
            setNodeExplanations(prev => ({ ...prev, [nodeId]: data }));
        } catch (err) {
            console.error('AI Explanation Error:', err);
        } finally {
            setExplainingNode(null);
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const toggleNodeExpand = (nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'RUNNING':
            case 'running':
                return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'PAUSED':
            case 'paused':
                return <Clock className="w-4 h-4 text-orange-500 animate-pulse" />;
            case 'SUCCESS':
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'FAILED':
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Clock className="w-4 h-4 text-slate-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RUNNING':
            case 'running':
                return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
            case 'PAUSED':
            case 'paused':
                return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
            case 'SUCCESS':
            case 'success':
                return 'bg-green-500/10 border-green-500/30 text-green-400';
            case 'FAILED':
            case 'error':
                return 'bg-red-500/10 border-red-500/30 text-red-400';
            default:
                return 'bg-slate-500/10 border-slate-500/30 text-slate-400';
        }
    };

    const completedNodes = Object.values(nodeStatuses).filter(
        (s) => s === 'SUCCESS' || s === 'FAILED'
    ).length;
    const totalNodes = nodes.length;
    const progress = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

    if (!executionId) {
        return (
            <div className="p-4 text-center text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{t.noExecution}</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <Activity className={`w-5 h-5 ${isPaused ? 'text-orange-500 animate-pulse' : 'text-blue-500'}`} />
                    <div>
                        <h3 className="font-medium text-white leading-none">{t.title}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 block">
                            {isPaused ? t.paused : t.running}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isPaused && onResume && (
                        <button
                            onClick={() => onResume()}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1 shadow-lg shadow-green-900/20"
                        >
                            <Play className="w-3 h-3 fill-current" />
                            {t.resume}
                        </button>
                    )}
                    <button
                        onClick={fetchExecutionDetails}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-500/30 text-sm rounded hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1"
                        >
                            <Square className="w-3 h-3" />
                            {t.cancel}
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4">
                <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-slate-400">{t.nodeProgress}</span>
                        <span className="text-white">
                            {completedNodes} / {totalNodes}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {nodes.map((node) => {
                        const status = nodeStatuses[node.id] || nodeStatuses[node.title] || 'waiting';
                        const output = nodeOutputs[node.id] || nodeOutputs[node.title];
                        const isExpanded = expandedNodes.has(node.id);

                        return (
                            <div
                                key={node.id}
                                className={`border rounded-lg overflow-hidden ${getStatusColor(status)}`}
                            >
                                <button
                                    onClick={() => output && toggleNodeExpand(node.id)}
                                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                                >
                                    {getStatusIcon(status)}
                                    <span className="flex-1 text-sm font-medium truncate">
                                        {node.title || node.id}
                                    </span>
                                    {output && (
                                        isExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                        )
                                    )}
                                </button>

                                    {isExpanded && output && (
                                        <div className="border-t border-current/20 p-3 bg-black/20 space-y-4">
                                            {/* Error Section with AI Button */}
                                            {status === 'FAILED' && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                                                            <XCircle size={14} />
                                                            {t.error}
                                                        </div>
                                                        <button
                                                            onClick={() => handleExplainError(node.id, node, output)}
                                                            disabled={!!explainingNode}
                                                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all text-[10px] font-bold uppercase tracking-widest border border-blue-500/30 disabled:opacity-50"
                                                        >
                                                            {explainingNode === node.id ? (
                                                                <>
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                    {t.explaining}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Sparkles size={12} />
                                                                    {t.explainWithAI}
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* AI Diagnosis Display */}
                                                    {nodeExplanations[node.id] && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-3"
                                                        >
                                                            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-widest">
                                                                <BrainCircuit size={14} />
                                                                {t.aiExplanation}
                                                            </div>
                                                            
                                                            <p className="text-xs text-slate-300 leading-relaxed">
                                                                {nodeExplanations[node.id].explanation}
                                                            </p>

                                                            {nodeExplanations[node.id].possibleCauses.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.possibleCauses}</div>
                                                                    <ul className="space-y-1">
                                                                        {nodeExplanations[node.id].possibleCauses.map((cause, i) => (
                                                                            <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                                                                                <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />
                                                                                {cause}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {nodeExplanations[node.id].suggestedFixes.length > 0 && (
                                                                <div className="space-y-2 pt-1">
                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.suggestedFixes}</div>
                                                                    {nodeExplanations[node.id].suggestedFixes.map((fix, i) => (
                                                                        <div key={i} className="bg-slate-900/50 border border-slate-800 rounded p-2 space-y-2">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                                                                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                                                                        fix.priority === 'high' ? 'bg-red-500' : fix.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                                                                                    }`} />
                                                                                    {fix.title}
                                                                                </div>
                                                                                {fix.code && (
                                                                                    <button
                                                                                        onClick={() => handleCopyCode(fix.code!)}
                                                                                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-blue-400 transition-colors"
                                                                                        title={t.copyCode}
                                                                                    >
                                                                                        {copiedCode === fix.code ? <Check size={12} /> : <Copy size={12} />}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-400 leading-tight">
                                                                                {fix.description}
                                                                            </p>
                                                                            {fix.code && (
                                                                                <pre className="text-[10px] font-mono bg-black/40 p-1.5 rounded text-blue-300 overflow-x-auto border border-white/5">
                                                                                    {fix.code}
                                                                                </pre>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {nodeExplanations[node.id].documentation && (
                                                                <a
                                                                    href={nodeExplanations[node.id].documentation}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-bold uppercase tracking-widest pt-1"
                                                                >
                                                                    {t.viewDocs}
                                                                    <ExternalLink size={10} />
                                                                </a>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </div>
                                            )}

                                            {nodeTestResults[node.id] && nodeTestResults[node.id].length > 0 && (

                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                                                    <Zap className="w-3 h-3" />
                                                    {t.tests}
                                                </div>
                                                <div className="space-y-1">
                                                    {nodeTestResults[node.id].map((test: any) => (
                                                        <div key={test.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700">
                                                            <div className="flex items-center gap-2">
                                                                {test.passed ? (
                                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                                ) : (
                                                                    <XCircle className={`w-3 h-3 ${test.severity === 'error' ? 'text-red-500' : 'text-orange-500'}`} />
                                                                )}
                                                                <span className="text-xs text-slate-300">{test.name}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${test.passed ? 'bg-green-500/10 text-green-500' : (test.severity === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500')}`}>
                                                                {test.passed ? t.testPassed.toUpperCase() : t.testFailed.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <div className="text-xs text-slate-400 mb-1">{t.output}:</div>
                                            <pre className="text-xs text-slate-300 overflow-x-auto max-h-32 overflow-y-auto custom-scrollbar p-2 bg-black/30 rounded">
                                                {JSON.stringify(output, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
