'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UseAgentChatOptions {
    conversationId: string | null;
    onFinish?: () => void;
}

/**
 * Wrapper around Vercel AI SDK v6 useChat that:
 * - Configures the transport to point at our backend conversation endpoint
 * - Provides legacy-style input handling (input, handleInputChange, handleSubmit)
 *   on top of the new sendMessage API
 */
export function useAgentChat({ conversationId, onFinish }: UseAgentChatOptions) {
    const [input, setInput] = useState('');

    const transport = useMemo(() => {
        if (!conversationId) return undefined;
        return new DefaultChatTransport({
            api: `${API_BASE}/api/chat/conversations/${conversationId}/messages`,
            // Map AI SDK request body to our backend's expected shape: { content }
            prepareSendMessagesRequest: ({ messages }) => {
                const lastMessage = messages[messages.length - 1];
                // Extract text content from the UI message parts
                const content = lastMessage?.parts
                    ?.filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('') || '';
                return {
                    body: { content },
                };
            },
        });
    }, [conversationId]);

    const chat = useChat({
        transport,
        onFinish: () => {
            onFinish?.();
        },
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || !conversationId) return;
        chat.sendMessage({ text: trimmed });
        setInput('');
    };

    const isLoading = chat.status === 'submitted' || chat.status === 'streaming';

    return {
        messages: chat.messages,
        input,
        setInput,
        handleInputChange,
        handleSubmit,
        isLoading,
        status: chat.status,
        error: chat.error,
        setMessages: chat.setMessages,
        sendMessage: chat.sendMessage,
    };
}
