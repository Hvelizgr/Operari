'use client';

import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import ChatMessage, { ChatMessageData } from './ChatMessage';

interface ChatMessageListProps {
  messages: ChatMessageData[];
  emptyTitle: string;
  emptyHint: string;
}

export default function ChatMessageList({ messages, emptyTitle, emptyHint }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-300">{emptyTitle}</h3>
          <p className="max-w-sm text-sm text-gray-500">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
