'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Command, Info, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface CommandAction {
  id: string;
  label: string; // "Zoom In"
  subLabel?: string; // "View"
  icon?: React.ReactNode;
  shortcut?: string[]; // ["Ctrl", "+"]
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
  lang: 'en' | 'es';
}

export default function CommandPalette({ isOpen, onClose, actions, lang }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter actions
  const filteredActions = actions.filter(
    action =>
      action.label.toLowerCase().includes(query.toLowerCase()) ||
      action.subLabel?.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus input
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredActions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    // Capture phase: another window keydown listener registered earlier
    // swallows keys typed in inputs, so with focus in the search box the
    // palette never saw Escape/Enter/arrows in the bubble phase.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  const Shortcut = ({ keys }: { keys: string[] }) => (
    <div className="op-60 ml-4 flex gap-1">
      {keys.map((k, i) => (
        <span
          key={i}
          className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
        >
          {k}
        </span>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Window */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '60vh' }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 border-b border-slate-800 p-4">
              <Search size={20} className="text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Type a command...' : 'Escribe un comando...'}
                className="flex-1 border-0 bg-transparent text-lg font-medium text-white outline-none placeholder:text-slate-600"
              />
              <div className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400">
                ESC
              </div>
            </div>

            {/* List */}
            <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                filteredActions.map((action, index) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${index === selectedIndex ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'} `}
                  >
                    <div className={`${index === selectedIndex ? 'text-white' : 'text-slate-500'}`}>
                      {action.icon || <Command size={16} />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{action.label}</div>
                      {action.subLabel && (
                        <div
                          className={`text-[10px] ${index === selectedIndex ? 'text-primary/20' : 'text-slate-500'}`}
                        >
                          {action.subLabel}
                        </div>
                      )}
                    </div>
                    {action.shortcut && <Shortcut keys={action.shortcut} />}
                    {index === selectedIndex && <ArrowRight size={14} className="opacity-50" />}
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-500">
                  <Info size={24} className="opacity-20" />
                  <span>{lang === 'en' ? 'No commands found' : 'No se encontraron comandos'}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 p-2 px-4 text-[10px] text-slate-500">
              <span>
                <span className="font-bold">↑↓</span> {lang === 'en' ? 'Navigate' : 'Navegar'}
              </span>
              <span>
                <span className="font-bold">↵</span> {lang === 'en' ? 'Select' : 'Seleccionar'}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
