'use client';

import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';

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
                    isUser ? 'bg-blue-600' : 'bg-emerald-600'
                }`}
            >
                {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
            </div>

            {/* Bubble */}
            <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-[#2a2f3a] text-gray-200 rounded-bl-md border border-[#3a3f4a]'
                }`}
            >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <span
                    className={`text-[10px] mt-1 block ${
                        isUser ? 'text-blue-200' : 'text-gray-500'
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
