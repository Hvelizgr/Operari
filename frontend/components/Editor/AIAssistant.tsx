'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, Bot, User, Loader2, Wand2, Check, ArrowRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import { Button, Input, Card, CardBody, Chip, ScrollShadow } from "@heroui/react";

interface Message {
    role: 'user' | 'assistant';
    content: string;
    nodes?: WorkflowNode[];
    connections?: Connection[];
}

interface AIAssistantProps {
    onApplyWorkflow: (nodes: WorkflowNode[], connections: Connection[]) => void;
    lang: 'en' | 'es';
}

export default function AIAssistant({ onApplyWorkflow, lang }: AIAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const data = await apiFetch('/api/ai/generate', {
                method: 'POST',
                body: JSON.stringify({ prompt: input })
            });

            const assistantMessage: Message = {
                role: 'assistant',
                content: data.explanation,
                nodes: data.nodes,
                connections: data.connections
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: lang === 'es' ? 'Lo siento, hubo un error al procesar tu solicitud.' : 'Sorry, there was an error processing your request.' 
            }]);
        } finally {
            setIsLoading(false);
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
                        className="mb-4 w-[400px] h-[500px] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} fill="currentColor" />
                                <span className="font-bold">NanoFlow AI</span>
                            </div>
                            <Button isIconOnly variant="light" size="sm" onClick={() => setIsOpen(false)} className="text-white">
                                <X size={18} />
                            </Button>
                        </div>

                        {/* Messages */}
                        <ScrollShadow className="flex-1 p-4 flex flex-col gap-4">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                                        msg.role === 'user' 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none'
                                    }`}>
                                        <div className="flex items-center gap-2 mb-1 opacity-70">
                                            {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {msg.role === 'user' ? (lang === 'es' ? 'Tú' : 'You') : 'AI'}
                                            </span>
                                        </div>
                                        <p className="leading-relaxed">{msg.content}</p>

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
                                <div className="flex justify-start">
                                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none p-3 flex gap-2 items-center">
                                        <Loader2 size={14} className="animate-spin text-blue-500" />
                                        <span className="text-xs text-slate-500">{lang === 'es' ? 'Pensando...' : 'Thinking...'}</span>
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
                                    placeholder={lang === 'es' ? 'Escribe aquí...' : 'Type here...'}
                                    value={input}
                                    onValueChange={setInput}
                                    variant="bordered"
                                    size="sm"
                                    classNames={{
                                        inputWrapper: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-10"
                                    }}
                                />
                                <Button 
                                    isIconOnly 
                                    color="primary" 
                                    type="submit" 
                                    disabled={!input.trim() || isLoading}
                                    className="h-10 w-10 min-w-0"
                                >
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
                            {lang === 'es' ? 'Preguntar a la IA' : 'Ask AI'}
                        </span>
                        <Sparkles size={24} fill="currentColor" />
                    </>
                )}
            </button>
        </div>
    );
}
