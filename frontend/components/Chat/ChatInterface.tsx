'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatSidebar, { ConversationSummary } from './ChatSidebar';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import { ChatMessageData } from './ChatMessage';
import { useAgentChat } from '@/hooks/useAgentChat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ChatInterfaceProps {
  lang: 'en' | 'es';
}

const t = (lang: 'en' | 'es') => ({
  title: lang === 'en' ? 'AI Assistant' : 'Asistente IA',
  newConversation: lang === 'en' ? 'New conversation' : 'Nueva conversación',
  placeholder:
    lang === 'en' ? 'Describe what you want to automate...' : 'Describí qué querés automatizar...',
  send: lang === 'en' ? 'Send' : 'Enviar',
  noConversations: lang === 'en' ? 'No conversations yet' : 'No hay conversaciones',
  noConversationsHint:
    lang === 'en'
      ? 'Start by describing what you want to automate'
      : 'Empezá describiendo qué querés automatizar',
  noMessages: lang === 'en' ? 'How can I help you?' : '¿En qué te puedo ayudar?',
  noMessagesHint:
    lang === 'en'
      ? "Tell me what you'd like to automate and I'll set it up for you."
      : 'Decime qué querés automatizar y lo configuro por vos.',
  sidebar: lang === 'en' ? 'Conversations' : 'Conversaciones',
});

export default function ChatInterface({ lang }: ChatInterfaceProps) {
  const labels = t(lang);
  const searchParams = useSearchParams();
  const deepLinkId = searchParams?.get('id') ?? null;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(deepLinkId);
  // unused but kept to preserve original message-bootstrap surface for future deep-link prefill
  const [, setInitialMessages] = useState<ChatMessageData[]>([]);

  // Streaming chat hook
  const {
    messages: streamMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    sendMessage,
  } = useAgentChat({
    conversationId: activeConversationId,
    onFinish: () => {
      fetchConversations();
    },
  });

  // Auto-submit a prompt when arriving via ?id=&prompt= (the
  // dashboard's "Ask AI" deep-link). Guarded by a ref so we only fire
  // once per prompt value, even across re-renders.
  const deepLinkPrompt = searchParams?.get('prompt') ?? null;
  const autoSubmittedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      deepLinkPrompt &&
      activeConversationId &&
      autoSubmittedPromptRef.current !== deepLinkPrompt &&
      streamMessages.length === 0
    ) {
      autoSubmittedPromptRef.current = deepLinkPrompt;
      sendMessage({ text: deepLinkPrompt });
    }
  }, [deepLinkPrompt, activeConversationId, streamMessages.length, sendMessage]);

  // Convert streaming messages to our display format
  // Vercel AI SDK v6 uses `parts` instead of `content`
  const displayMessages: ChatMessageData[] = streamMessages.map(msg => {
    const text =
      msg.parts
        ?.filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('') || '';
    return {
      id: msg.id,
      role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
      content: text,
      createdAt: new Date().toISOString(),
    };
  });

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(
          data.conversations.map((c: any) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            lastMessage: c.messages?.[0]?.content,
          }))
        );
      }
    } catch {
      // Backend might not be running
    }
  }, []);

  // Load messages when switching conversations
  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/chat/conversations/${id}`);
        if (res.ok) {
          const data = await res.json();
          // Load existing messages into the AI SDK chat state (v6 format with parts)
          const existingMessages = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role === 'USER' ? 'user' : 'assistant',
            parts: [{ type: 'text', text: m.content }],
          }));
          setMessages(existingMessages as any);
        }
      } catch {
        // Backend might not be running
      }
    },
    [setMessages]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Pick up deep-link ?id= changes (e.g. when "Ask AI" navigates here)
  useEffect(() => {
    if (deepLinkId && deepLinkId !== activeConversationId) {
      setActiveConversationId(deepLinkId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversation(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadConversation, setMessages]);

  // Create new conversation
  const handleCreateConversation = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const conv = await res.json();
        setActiveConversationId(conv.id);
        setMessages([]);
        await fetchConversations();
      }
    } catch {
      // Ignore
    }
  };

  // Delete (archive) conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/chat/conversations/${id}`, { method: 'DELETE' });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      await fetchConversations();
    } catch {
      // Ignore
    }
  };

  // Handle sending — auto-create conversation if none selected
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeConversationId) {
      // Create conversation first, then send
      try {
        const res = await fetch(`${API_BASE}/api/chat/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const conv = await res.json();
          setActiveConversationId(conv.id);
          await fetchConversations();
          // The message will be sent on next render when conversationId is set
          // We need to trigger submit after state update
          setTimeout(() => {
            handleSubmit(e);
          }, 100);
        }
      } catch {
        return;
      }
    } else {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full flex-1 bg-[#12151a]">
      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onCreate={handleCreateConversation}
        onDelete={handleDeleteConversation}
        lang={lang}
        labels={{
          sidebar: labels.sidebar,
          newConversation: labels.newConversation,
          noConversations: labels.noConversations,
          noConversationsHint: labels.noConversationsHint,
        }}
      />

      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar */}
        <div className="flex h-[50px] items-center border-b border-[#2a2f3a] bg-[#1a1e26] px-4">
          <h1 className="text-sm font-semibold text-gray-300">{labels.title}</h1>
          {isLoading && (
            <span className="text-primary/70 ml-3 animate-pulse text-xs">
              {lang === 'en' ? 'Thinking...' : 'Pensando...'}
            </span>
          )}
        </div>

        {/* Messages */}
        <ChatMessageList
          messages={displayMessages}
          emptyTitle={labels.noMessages}
          emptyHint={labels.noMessagesHint}
        />

        {/* Input */}
        <div className="border-t border-[#3a3f4a] bg-[#1e222a] p-4">
          <form onSubmit={handleSend} className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={labels.placeholder}
              disabled={isLoading}
              rows={1}
              className="focus:border-primary flex-1 resize-none rounded-xl border border-[#3a3f4a] bg-[#2a2f3a] px-4 py-3 text-sm text-gray-200 placeholder-gray-500 transition-colors focus:outline-none disabled:opacity-50"
              style={{
                height: 'auto',
                minHeight: '44px',
                maxHeight: '160px',
              }}
              ref={el => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-primary hover:bg-primary disabled:hover:bg-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-30"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
