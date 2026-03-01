'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Bot, User, Loader2, Wand2, BrainCircuit, Activity, Eye, Search, Database, Maximize2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import { Button, Input, Card, CardBody, Chip, ScrollShadow, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from "@heroui/react";

interface ThinkingStep {
    type: 'reasoning' | 'observation' | 'tool_use' | 'search' | 'system';
    title: string;
    content: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    nodes?: WorkflowNode[];
    connections?: Connection[];
    thinkingSteps?: ThinkingStep[];
    sources?: Array<{ title: string; content: string; score?: number }>;
}

interface AIAssistantProps {
    onApplyWorkflow: (nodes: WorkflowNode[], connections: Connection[]) => void;
    lang: 'en' | 'es';
}

export default function AIAssistant({ onApplyWorkflow, lang }: AIAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { isOpen: isChunkOpen, onOpen: onChunkOpen, onClose: onChunkClose } = useDisclosure();
    const [selectedChunk, setSelectedChunk] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([
        { 
            role: 'assistant', 
            content: lang === 'es' 
                ? '¡Hola! Soy tu asistente de NanoFlow. ¿En qué flujo puedo ayudarte hoy?' 
                : 'Hi! I am your NanoFlow assistant. What workflow can I help you build today?' 
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeThinkingSteps, setActiveThinkingSteps] = useState<ThinkingStep[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollingInterval = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, activeThinkingSteps, isOpen]);

    const handleChunkClick = (chunk: any) => {
        setSelectedChunk(chunk);
        onChunkOpen();
    };

    const startPollingThinkingProcess = (sessionId: string) => {
        if (pollingInterval.current) clearInterval(pollingInterval.current);
        pollingInterval.current = setInterval(async () => {
            try {
                const steps = await apiFetch(`/api/ai/thinking-process/${sessionId}`);
                if (steps && Array.isArray(steps)) {
                    setActiveThinkingSteps(steps);
                }
            } catch (error) {
                console.error('Error polling thinking process:', error);
            }
        }, 1500);
    };

    const stopPollingThinkingProcess = () => {
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }
    };

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
        };
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setActiveThinkingSteps([]);

        startPollingThinkingProcess(sessionId);

        try {
            const data = await apiFetch('/api/ai/generate', {
                method: 'POST',
                body: JSON.stringify({ prompt: input, sessionId })
            });

            stopPollingThinkingProcess();
            const finalSteps = await apiFetch(`/api/ai/thinking-process/${sessionId}`).catch(() => []);

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.explanation,
                nodes: data.nodes,
                connections: data.connections,
                thinkingSteps: finalSteps.length > 0 ? finalSteps : activeThinkingSteps,
                sources: data.sources
            };
            setMessages(prev => [...prev, assistantMessage]);
            setActiveThinkingSteps([]);
        } catch (error) {
            stopPollingThinkingProcess();
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: lang === 'es' ? 'Lo siento, hubo un error al procesar tu solicitud.' : 'Sorry, there was an error processing your request.' 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const getStepIcon = (type: ThinkingStep['type']) => {
        switch (type) {
            case 'reasoning': return <BrainCircuit size={14} className="text-purple-500" />;
            case 'observation': return <Eye size={14} className="text-blue-500" />;
            case 'tool_use': return <Wand2 size={14} className="text-amber-500" />;
            case 'search': return <Search size={14} className="text-emerald-500" />;
            default: return <Activity size={14} className="text-slate-500" />;
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 w-[450px] h-[600px] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} fill="currentColor" />
                                <span className="font-bold">NanoFlow AI Assistant</span>
                            </div>
                            <Button isIconOnly variant="light" size="sm" onClick={() => setIsOpen(false)} className="text-white">
                                <X size={18} />
                            </Button>
                        </div>

                        {/* Messages */}
                        <ScrollShadow className="flex-1 p-4 flex flex-col gap-4">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[90%] rounded-2xl p-3 text-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-1 opacity-70">
                                            {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {msg.role === 'user' ? (lang === 'es' ? 'Tú' : 'You') : 'AI Agent'}
                                            </span>
                                        </div>
                                        
                                        {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                                            <div className="mb-3 bg-slate-50/50 dark:bg-slate-950/30 rounded-lg p-2 border border-slate-200/50 dark:border-slate-700/50">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight">
                                                    <BrainCircuit size={10} />
                                                    {lang === 'es' ? 'Proceso de Razonamiento' : 'Reasoning Process'}
                                                </div>
                                                <div className="space-y-2">
                                                    {msg.thinkingSteps.map((step, idx) => (
                                                        <div key={idx} className="flex gap-2">
                                                            <div className="mt-0.5">{getStepIcon(step.type)}</div>
                                                            <div>
                                                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{step.title}</div>
                                                                <div className="text-[10px] text-slate-500 line-clamp-2">{step.content}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <Database size={10} />
                                                    {lang === 'es' ? 'Fuentes Recuperadas' : 'Recovered Sources'}
                                                </div>
                                                <ScrollShadow orientation="horizontal" className="flex gap-2 pb-2">
                                                    {msg.sources.map((source, idx) => (
                                                        <Card 
                                                            key={idx} 
                                                            isPressable 
                                                            onClick={() => handleChunkClick(source)}
                                                            className="min-w-[200px] max-w-[200px] bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 shadow-none hover:border-blue-500/50 transition-colors"
                                                        >
                                                            <CardBody className="p-2 space-y-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] font-bold truncate text-blue-600 dark:text-blue-400">
                                                                        {source.title}
                                                                    </span>
                                                                    <Maximize2 size={8} className="opacity-50" />
                                                                </div>
                                                                <p className="text-[9px] text-slate-500 dark:text-slate-400 line-clamp-3 leading-tight italic">
                                                                    "{source.content}"
                                                                </p>
                                                            </CardBody>
                                                        </Card>
                                                    ))}
                                                </ScrollShadow>
                                            </div>
                                        )}

                                        {msg.nodes && msg.nodes.length > 0 && (
                                            <Card className="mt-3 bg-white/10 border-white/20">
                                                <CardBody className="p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-semibold">{msg.nodes.length} nodes suggested</span>
                                                        <Chip size="sm" color="success" variant="flat">Ready</Chip>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        fullWidth 
                                                        color="primary"
                                                        className="font-bold gap-2"
                                                        onClick={() => onApplyWorkflow(msg.nodes!, msg.connections!)}
                                                    >
                                                        <Wand2 size={14} />
                                                        {lang === 'es' ? 'Aplicar al Lienzo' : 'Apply to Canvas'}
                                                    </Button>
                                                </CardBody>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex flex-col items-start gap-2">
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none p-4 w-[90%] border border-blue-500/20 shadow-lg shadow-blue-500/5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Loader2 size={18} className="animate-spin text-blue-500" />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                                {lang === 'es' ? 'Agente Procesando...' : 'Agent Thinking...'}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {activeThinkingSteps.slice(-3).map((step, idx) => (
                                                <div key={idx} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2">
                                                    <div className="mt-1 p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                        {getStepIcon(step.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{step.title}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{step.content}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </ScrollShadow>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                className="flex gap-2"
                            >
                                <Input
                                    placeholder={lang === 'es' ? 'Escribe aquí tu petición...' : 'Type your request here...'}
                                    value={input}
                                    onValueChange={setInput}
                                    variant="bordered"
                                    size="sm"
                                    classNames={{
                                        inputWrapper: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10 shadow-sm"
                                    }}
                                />
                                <Button isIconOnly color="primary" type="submit" disabled={!input.trim() || isLoading} className="h-10 w-10 min-w-0 font-bold">
                                    <Send size={18} />
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-4 rounded-full shadow-2xl text-white transition-all transform hover:scale-110 active:scale-95 flex items-center gap-3 group ${
                    isOpen ? 'bg-slate-700' : 'bg-gradient-to-tr from-blue-600 to-purple-600'
                }`}
            >
                {isOpen ? <X size={24} /> : (
                    <>
                        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold whitespace-nowrap">
                            {lang === 'es' ? 'Asistente de NanoFlow' : 'NanoFlow Assistant'}
                        </span>
                        <Sparkles size={24} fill="currentColor" />
                    </>
                )}
            </button>

            {/* Chunk Detail Modal */}
            <Modal isOpen={isChunkOpen} onClose={onChunkClose} backdrop="blur" size="lg">
                <ModalContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <ModalHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-blue-600">
                            <Database size={18} />
                            <span className="text-lg font-bold">{selectedChunk?.title}</span>
                        </div>
                    </ModalHeader>
                    <ModalBody className="pb-8">
                        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif italic text-slate-700 dark:text-slate-300">
                            "{selectedChunk?.content}"
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
}
