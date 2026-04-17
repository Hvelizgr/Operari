'use client';

import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatMessageData {
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
    content: string;
    createdAt: string;
}

interface ChatMessageProps {
    message: ChatMessageData;
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'USER';

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        >
            {/* Avatar */}
            <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isUser ? 'bg-primary' : 'bg-emerald-600'
                }`}
            >
                {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
            </div>

            {/* Bubble */}
            <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-[#2a2f3a] text-gray-200 rounded-bl-md border border-[#3a3f4a]'
                }`}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                    <div className="markdown-body">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ inline, className, children, ...props }: any) {
                                    if (inline) {
                                        return (
                                            <code
                                                className="px-1 py-0.5 rounded bg-black/40 text-amber-300 text-[12px] font-mono"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }
                                    return (
                                        <pre className="my-2 p-3 rounded-md bg-black/50 border border-white/10 overflow-x-auto text-[12px] font-mono text-gray-100">
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        </pre>
                                    );
                                },
                                a({ children, href, ...props }: any) {
                                    return (
                                        <a
                                            href={href}
                                            className="text-primary/70 hover:text-primary/40 underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            {...props}
                                        >
                                            {children}
                                        </a>
                                    );
                                },
                                ul({ children }: any) {
                                    return (
                                        <ul className="list-disc list-inside my-1 space-y-0.5">
                                            {children}
                                        </ul>
                                    );
                                },
                                ol({ children }: any) {
                                    return (
                                        <ol className="list-decimal list-inside my-1 space-y-0.5">
                                            {children}
                                        </ol>
                                    );
                                },
                                p({ children }: any) {
                                    return <p className="my-1 leading-relaxed">{children}</p>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                )}
                <span
                    className={`text-[10px] mt-1 block ${
                        isUser ? 'text-primary/20' : 'text-gray-500'
                    }`}
                >
                    {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
            </div>
        </motion.div>
    );
}
