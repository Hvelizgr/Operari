'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Globe, Webhook, Zap, Terminal, CheckCircle2, Clock, Bot, RefreshCw } from 'lucide-react';
import type { content } from '../../content/en';
import { useParams } from 'next/navigation';

type EditorProps = {
    content: typeof content.editor;
};

export default function EditorSimulation({ content }: EditorProps) {
    const params = useParams();
    const lang = params.lang || 'en';
    const isEs = lang === 'es';

    // Translated execution logs
    const executionLogs = [
        { type: 'info', message: isEs ? '▶ Workflow iniciado via webhook' : '▶ Workflow triggered via webhook', time: '0ms' },
        { type: 'data', message: isEs ? '📦 Payload recibido: { orders: 847 }' : '📦 Received payload: { orders: 847 }', time: '12ms' },
        { type: 'process', message: isEs ? '⚙️ Transformando datos...' : '⚙️ Transforming data...', time: '45ms' },
        { type: 'success', message: isEs ? '✓ 847 registros procesados' : '✓ 847 records processed', time: '156ms' },
        { type: 'api', message: isEs ? '🌐 Sincronizando con Salesforce CRM...' : '🌐 Syncing to Salesforce CRM...', time: '234ms' },
        { type: 'success', message: isEs ? '✓ Llamada API exitosa (200 OK)' : '✓ API call successful (200 OK)', time: '412ms' },
        { type: 'db', message: isEs ? '💾 Guardando en PostgreSQL...' : '💾 Saving to PostgreSQL...', time: '456ms' },
        { type: 'success', message: isEs ? '✓ 847 filas insertadas' : '✓ 847 rows inserted', time: '523ms' },
        { type: 'complete', message: isEs ? '🎉 ¡Workflow completado exitosamente!' : '🎉 Workflow completed successfully!', time: '531ms' },
    ];

    // Translated stats
    const stats = [
        { label: isEs ? 'Ejecuciones Hoy' : 'Executions Today', value: '12,847', change: '+23%', color: 'text-green-400' },
        { label: isEs ? 'Respuesta Prom.' : 'Avg Response', value: '145ms', change: '-12%', color: 'text-green-400' },
        { label: isEs ? 'Tasa de Éxito' : 'Success Rate', value: '99.8%', change: '+0.2%', color: 'text-green-400' },
    ];

    // Translated nodes
    const nodes = [
        { icon: Webhook, label: isEs ? 'Webhook Trigger' : 'Webhook Trigger', desc: 'POST /api/orders', color: 'from-blue-500 to-cyan-500', activeAt: 1 },
        { icon: Zap, label: isEs ? 'Transformar Datos' : 'Transform Data', desc: isEs ? 'Mapear y validar' : 'Map & validate', color: 'from-purple-500 to-pink-500', activeAt: 3 },
        { icon: Globe, label: isEs ? 'Integración API' : 'API Integration', desc: 'Salesforce CRM', color: 'from-orange-500 to-red-500', activeAt: 5 },
        { icon: Database, label: isEs ? 'Sincronizar BD' : 'Database Sync', desc: 'PostgreSQL', color: 'from-green-500 to-emerald-500', activeAt: 7 },
    ];

    const text = {
        badge: isEs ? 'Automatización en Tiempo Real' : 'Real-time Automation',
        pipeline: isEs ? 'Pipeline del Workflow' : 'Workflow Pipeline',
        logs: isEs ? 'Logs de Ejecución' : 'Execution Logs',
        running: isEs ? 'Ejecutando...' : 'Running...',
        success: isEs ? 'Éxito' : 'Success',
        runtime: 'Runtime: Node.js 20',
        region: 'Region: us-east-1',
        connected: isEs ? 'Conectado' : 'Connected',
    };

    const [visibleLogs, setVisibleLogs] = useState<number>(0);
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        const runWorkflow = () => {
            setIsRunning(true);
            setVisibleLogs(0);
            
            let i = 0;
            const interval = setInterval(() => {
                if (i < executionLogs.length) {
                    setVisibleLogs(i + 1);
                    i++;
                } else {
                    clearInterval(interval);
                    setTimeout(() => {
                        setIsRunning(false);
                        setTimeout(runWorkflow, 2000);
                    }, 1500);
                }
            }, 400);
        };

        const timeout = setTimeout(runWorkflow, 1000);
        return () => clearTimeout(timeout);
    }, []);

    return (
        <section className="py-24 bg-black overflow-hidden relative">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-purple-600/10 rounded-full blur-[150px]" />
            
            <div className="container px-4 relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6"
                    >
                        <Bot className="w-4 h-4" />
                        <span>{text.badge}</span>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-bold text-white mb-6"
                    >
                        {content.title}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-gray-400 max-w-2xl mx-auto"
                    >
                        {content.description}
                    </motion.p>
                </div>

                {/* Stats Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-12"
                >
                    {stats.map((stat, idx) => (
                        <div key={idx} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                            <div className={`text-xs ${stat.color} mt-1`}>{stat.change}</div>
                        </div>
                    ))}
                </motion.div>

                {/* Main Visualization */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="max-w-5xl mx-auto"
                >
                    <div className="rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl overflow-hidden shadow-2xl">
                        {/* Top bar */}
                        <div className="h-12 bg-zinc-900/80 border-b border-white/10 flex items-center justify-between px-4">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-sm text-gray-500 font-mono ml-2">order-sync-workflow.nf</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {isRunning ? (
                                    <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>{text.running}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-green-400 text-sm">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>{text.success}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            {/* Left: Flow visualization */}
                            <div className="p-6 border-b lg:border-b-0 lg:border-r border-white/10">
                                <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    <span>{text.pipeline}</span>
                                </div>
                                
                                {/* Visual nodes */}
                                <div className="space-y-4">
                                    {nodes.map((node, idx) => (
                                        <div key={idx} className="flex items-center gap-4">
                                            <motion.div 
                                                className={`
                                                    w-12 h-12 rounded-xl bg-gradient-to-br ${node.color} 
                                                    flex items-center justify-center shadow-lg
                                                    ${visibleLogs >= node.activeAt ? 'ring-2 ring-white/30' : 'opacity-50'}
                                                `}
                                                animate={visibleLogs >= node.activeAt ? { scale: [1, 1.05, 1] } : {}}
                                                transition={{ duration: 0.5 }}
                                            >
                                                <node.icon className="w-6 h-6 text-white" />
                                            </motion.div>
                                            <div className="flex-1">
                                                <div className="font-medium text-white">{node.label}</div>
                                                <div className="text-xs text-gray-500">{node.desc}</div>
                                            </div>
                                            {visibleLogs >= node.activeAt && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                >
                                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                                </motion.div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Live logs */}
                            <div className="p-6">
                                <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                                    <Terminal className="w-4 h-4 text-green-400" />
                                    <span>{text.logs}</span>
                                    <Clock className="w-3 h-3 ml-auto" />
                                    <span className="text-xs font-mono">
                                        {visibleLogs > 0 && executionLogs[visibleLogs - 1]?.time}
                                    </span>
                                </div>

                                <div className="bg-black/50 rounded-lg p-4 h-[280px] overflow-hidden font-mono text-sm">
                                    <AnimatePresence>
                                        {executionLogs.slice(0, visibleLogs).map((log, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`mb-2 flex items-start gap-2 ${
                                                    log.type === 'success' ? 'text-green-400' :
                                                    log.type === 'data' ? 'text-blue-400' :
                                                    log.type === 'process' ? 'text-yellow-400' :
                                                    log.type === 'api' ? 'text-purple-400' :
                                                    log.type === 'db' ? 'text-cyan-400' :
                                                    log.type === 'complete' ? 'text-emerald-400' :
                                                    'text-gray-400'
                                                }`}
                                            >
                                                <span className="text-gray-600 text-xs w-12">{log.time}</span>
                                                <span>{log.message}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    
                                    {isRunning && visibleLogs < executionLogs.length && (
                                        <motion.div
                                            animate={{ opacity: [1, 0.5, 1] }}
                                            transition={{ duration: 0.8, repeat: Infinity }}
                                            className="text-gray-500"
                                        >
                                            <span className="inline-block w-2 h-4 bg-gray-500 animate-pulse" />
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom bar */}
                        <div className="h-10 bg-zinc-900/50 border-t border-white/10 flex items-center justify-between px-4 text-xs text-gray-500">
                            <div className="flex items-center gap-4">
                                <span>{text.runtime}</span>
                                <span>{text.region}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span>{text.connected}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
