'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  lastMessage?: string;
}

interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  lang: 'en' | 'es';
  labels: {
    sidebar: string;
    newConversation: string;
    noConversations: string;
    noConversationsHint: string;
  };
}

export default function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  lang,
  labels,
}: ChatSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      className="flex h-full flex-col border-r border-[#2a2f3a] bg-[#1a1e26]"
      initial={{ width: 280 }}
      animate={{ width: collapsed ? 50 : 280 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex h-[50px] items-center justify-between border-b border-[#2a2f3a] px-3">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-semibold text-gray-300"
          >
            {labels.sidebar}
          </motion.span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={
            collapsed
              ? lang === 'en'
                ? 'Expand conversations'
                : 'Expandir conversaciones'
              : lang === 'en'
                ? 'Collapse conversations'
                : 'Contraer conversaciones'
          }
          aria-expanded={!collapsed}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-white/10"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Conversation Button */}
      <div className="p-2">
        <button
          onClick={onCreate}
          className={`bg-primary hover:bg-primary flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Plus size={16} />
          {!collapsed && <span>{labels.newConversation}</span>}
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && !collapsed && (
          <div className="px-3 py-8 text-center">
            <MessageSquare size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">{labels.noConversationsHint}</p>
          </div>
        )}

        <AnimatePresence>
          {conversations.map(conv => {
            const isActive = conv.id === activeId;
            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => onSelect(conv.id)}
                className={`group my-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <MessageSquare size={14} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">
                      {conv.title || (lang === 'en' ? 'New conversation' : 'Nueva conversación')}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="rounded p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                    >
                      <Trash2 size={12} className="text-gray-500" />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
