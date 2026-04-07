'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder: string;
    sendLabel: string;
}

export default function ChatInput({ onSend, disabled, placeholder, sendLabel }: ChatInputProps) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, [value]);

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="border-t border-[#3a3f4a] bg-[#1e222a] p-4">
            <div className="flex items-end gap-3 max-w-3xl mx-auto">
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={1}
                    className="flex-1 bg-[#2a2f3a] text-gray-200 rounded-xl px-4 py-3 text-sm resize-none
                               border border-[#3a3f4a] focus:border-blue-500 focus:outline-none
                               placeholder-gray-500 disabled:opacity-50 transition-colors"
                />
                <button
                    onClick={handleSubmit}
                    disabled={disabled || !value.trim()}
                    title={sendLabel}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center
                               hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
