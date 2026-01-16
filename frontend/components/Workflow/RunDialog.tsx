// frontend/components/Workflow/RunDialog.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Bug } from 'lucide-react';

interface LogEntry {
    timestamp: string;
    message: string;
    metadata?: any;
}

interface RunDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onRun: (input: object) => void;
    lang: 'en' | 'es';
    isExecuting?: boolean;
    logs?: LogEntry[];
    executionId?: string | null;
    mode?: 'run' | 'debug';
}

export default function RunDialog({ isOpen, onClose, onRun, lang, isExecuting = false, logs = [], executionId, mode = 'run' }: RunDialogProps) {
    const [jsonInput, setJsonInput] = useState(`{\n  "key": "value"\n}`);
    const [error, setError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);

    // ... timer logic ... (Same as before)
    // Timer for elapsed time
    useState(() => {
        const interval = setInterval(() => {
            if (isExecuting) {
                setElapsed(prev => prev + 0.1);
            } else {
                setElapsed(0);
            }
        }, 100);
        return () => clearInterval(interval);
    });

    const handleRunClick = () => {
        try {
            const parsedInput = JSON.parse(jsonInput);
            setError(null);
            onRun(parsedInput);
        } catch {
            setError(lang === 'en' ? 'Invalid JSON format.' : 'Formato JSON inválido.');
        }
    };

    const text = {
        en: {
            title: isExecuting ? (mode === 'debug' ? 'Debugging Workflow...' : 'Executing Workflow...') : (mode === 'debug' ? 'Debug Workflow' : 'Run Workflow'),
            description: 'Provide JSON Input:',
            run: mode === 'debug' ? 'Start Debugging' : 'Run Workflow',
            cancel: isExecuting ? 'Close' : 'Cancel',
            jobId: 'Job ID',
            status: 'Status',
            elapsed: 'Elapsed',
            cpu: 'Avg CPU',
            mem: 'Avg Mem',
        },
        es: {
            title: isExecuting ? (mode === 'debug' ? 'Depurando Flujo...' : 'Ejecutando Flujo...') : (mode === 'debug' ? 'Depurar Flujo' : 'Ejecutar Flujo'),
            description: 'Entrada JSON:',
            run: mode === 'debug' ? 'Iniciar Depuración' : 'Ejecutar',
            cancel: isExecuting ? 'Cerrar' : 'Cancelar',
            jobId: 'ID Trabajo',
            status: 'Estado',
            elapsed: 'Tiempo',
            cpu: 'CPU Prom',
            mem: 'Mem Prom',
        }
    }[lang];

    // Simulated Stats or Real if provided (future)
    const cpuUsage = isExecuting ? Math.floor(Math.random() * 30 + 10) + '%' : '0%';
    const memUsage = isExecuting ? Math.floor(Math.random() * 200 + 50) + 'MB' : '0MB';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="dialog shadow-[0px_0px_50px_rgba(0,0,0,0.8)] border border-[var(--highlight-color)]/30"
                        style={{
                            width: '600px',
                            background: 'var(--box-background-color)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        } as any}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Title Bar */}
                        <div
                            className="dialog_title"
                            style={{
                                background: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
                                borderBottom: '1px solid var(--border-color)',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '15px',
                                fontWeight: 'bold',
                                color: 'var(--highlight-color)',
                                letterSpacing: '0.05em'
                            }}
                        >
                            <div className="flex items-center gap-2">
                                {mode === 'debug' ? (
                                    <Bug size={16} className={isExecuting ? "animate-pulse text-orange-400" : "text-orange-400"} />
                                ) : (
                                    <Play size={16} className={isExecuting ? "animate-pulse text-green-400" : ""} />
                                )}
                                {text.title}
                            </div>
                            {!isExecuting && (
                                <button className="opacity-50 hover:opacity-100 transition-opacity" onClick={onClose}>
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Content Switcher */}
                        <div className="p-6">
                            {!isExecuting ? (
                                // INPUT MODE
                                <div className="flex flex-col gap-4">
                                    <div className="text-xs font-bold uppercase text-[var(--descriptor-color)] tracking-wider">{text.description}</div>
                                    <textarea
                                        value={jsonInput}
                                        onChange={(e) => setJsonInput(e.target.value)}
                                        className="w-full h-48 p-3 rounded-lg border border-[var(--border-color)] bg-[rgba(0,0,0,0.3)] font-mono text-sm focus:outline-none focus:border-[var(--highlight-color)] resize-none text-[var(--body-text-color)] transition-colors shadow-inner"
                                        spellCheck="false"
                                    />
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded flex items-center gap-2">
                                            <X size={12} /> {error}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // EXECUTION MODE (MAGIC RUN)
                                <div className="flex flex-col gap-6">
                                    {/* Progress Bar */}
                                    <div className="w-full bg-[rgba(255,255,255,0.1)] h-2 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-green-400 absolute top-0 left-0 transition-all duration-300"
                                            style={{ width: '100%', animation: 'progress-indeterminate 2s infinite linear' }}
                                        />
                                        <style jsx>{`
                                            @keyframes progress-indeterminate {
                                                0% { left: -100%; width: 50%; }
                                                50% { left: 25%; width: 50%; }
                                                100% { left: 100%; width: 50%; }
                                            }
                                        `}</style>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[var(--border-color)] flex flex-col items-center">
                                            <span className="text-[10px] uppercase text-[var(--descriptor-color)] font-bold mb-1">{text.jobId}</span>
                                            <span className="font-mono text-sm text-[var(--highlight-color)]">
                                                {executionId ? `J-${executionId.slice(0, 8)}` : 'Init...'}
                                            </span>
                                        </div>
                                        <div className="bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[var(--border-color)] flex flex-col items-center">
                                            <span className="text-[10px] uppercase text-[var(--descriptor-color)] font-bold mb-1">{text.status}</span>
                                            <span className="text-sm text-green-400 font-bold animate-pulse">RUNNING</span>
                                        </div>
                                        <div className="bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[var(--border-color)] flex flex-col items-center">
                                            <span className="text-[10px] uppercase text-[var(--descriptor-color)] font-bold mb-1">{text.elapsed}</span>
                                            <span className="font-mono text-sm text-white">{elapsed.toFixed(1)}s</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[var(--border-color)] flex items-center justify-between px-6">
                                            <span className="text-xs uppercase text-[var(--descriptor-color)] font-bold">{text.cpu}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1 bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: cpuUsage }} />
                                                </div>
                                                <span className="font-mono text-xs text-white w-8 text-right">{cpuUsage}</span>
                                            </div>
                                        </div>
                                        <div className="bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[var(--border-color)] flex items-center justify-between px-6">
                                            <span className="text-xs uppercase text-[var(--descriptor-color)] font-bold">{text.mem}</span>
                                            <span className="font-mono text-sm text-white">{memUsage}</span>
                                        </div>
                                    </div>

                                    {/* Latest Log */}
                                    <div className="bg-black/40 p-3 rounded border border-[var(--border-color)] font-mono text-xs h-32 overflow-y-auto text-gray-300">
                                        {logs.slice(-5).map((log, i) => {
                                            const isError = log.message.toLowerCase().includes('error') || log.message.toLowerCase().includes('fail');
                                            return (
                                                <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                                    <span className="text-[var(--descriptor-color)] mr-2">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                    <span className={isError ? 'text-red-400' : 'text-gray-300'}>{log.message}</span>
                                                </div>
                                            );
                                        })}
                                        {logs.length === 0 && <span className="opacity-50 italic">Initializing execution context...</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer (Buttons) */}
                        <div className="p-4 border-t border-[var(--border-color)] bg-[rgba(0,0,0,0.2)] flex justify-end gap-3">
                            {!isExecuting && (
                                <button
                                    className="px-6 py-2 rounded hover:bg-white/5 text-[var(--body-text-color)] transition-colors text-sm font-medium"
                                    onClick={onClose}
                                >
                                    {text.cancel}
                                </button>
                            )}
                            {!isExecuting ? (
                                <button
                                    className="px-6 py-2 rounded bg-[var(--theme-color)] hover:brightness-110 text-white shadow-lg shadow-[var(--theme-color)]/20 transition-all text-sm font-bold flex items-center gap-2"
                                    onClick={handleRunClick}
                                >
                                    <Play size={14} fill="currentColor" />
                                    {text.run}
                                </button>
                            ) : (
                                <button
                                    className="px-6 py-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 transition-all text-sm font-bold"
                                    onClick={onClose}
                                >
                                    Stop Execution
                                </button>
                            )}
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
