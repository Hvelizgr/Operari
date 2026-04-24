'use client';

import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
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
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary' : 'bg-emerald-600'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary rounded-br-md text-white'
            : 'rounded-bl-md border border-[#3a3f4a] bg-[#2a2f3a] text-gray-200'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={
                {
                  code({
                    inline,
                    className,
                    children,
                    ...props
                  }: {
                    inline?: boolean;
                    className?: string;
                    children?: React.ReactNode;
                  }) {
                    if (inline) {
                      return (
                        <code
                          className="rounded bg-black/40 px-1 py-0.5 font-mono text-[12px] text-amber-300"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="my-2 overflow-x-auto rounded-md border border-white/10 bg-black/50 p-3 font-mono text-[12px] text-gray-100">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  a({ children, href, ...props }: { children?: React.ReactNode; href?: string }) {
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
                  ul({ children }: { children?: React.ReactNode }) {
                    return <ul className="my-1 list-inside list-disc space-y-0.5">{children}</ul>;
                  },
                  ol({ children }: { children?: React.ReactNode }) {
                    return (
                      <ol className="my-1 list-inside list-decimal space-y-0.5">{children}</ol>
                    );
                  },
                  p({ children }: { children?: React.ReactNode }) {
                    return <p className="my-1 leading-relaxed">{children}</p>;
                  },
                } as Components
              }
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <span className={`mt-1 block text-[10px] ${isUser ? 'text-primary/20' : 'text-gray-500'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  );
}
