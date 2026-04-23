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
      <div className="mx-auto flex max-w-3xl items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="focus:border-primary flex-1 resize-none rounded-xl border border-[#3a3f4a] bg-[#2a2f3a] px-4 py-3 text-sm text-gray-200 placeholder-gray-500 transition-colors focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          title={sendLabel}
          className="bg-primary hover:bg-primary disabled:hover:bg-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:opacity-30"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
