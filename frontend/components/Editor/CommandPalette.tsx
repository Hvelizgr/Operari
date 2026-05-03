'use client';

import { Command as CommandKit } from 'cmdk';
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

/**
 * Sprint 3 — `cmdk`-backed command palette.
 *
 * The previous version hand-rolled query filtering, keyboard nav
 * (ArrowUp/Down/Enter), and selectedIndex state. cmdk gives us all
 * three out of the box plus better a11y (proper ARIA roles, screen
 * reader support, focus management) and built-in fuzzy match
 * scoring. The public API (CommandAction, isOpen, onClose, lang) is
 * preserved so every call site (GlobalCommandPalette, future
 * scoped palettes) continues to work without changes.
 *
 * The framer-motion overlay + slate-900 chrome stays — the brand
 * shell is unchanged. cmdk only owns the input + list + filter
 * loop; visual scaffolding stays ours.
 */
export default function CommandPalette({ isOpen, onClose, actions, lang }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  // Reset query + focus on open. cmdk doesn't manage focus across
  // mount cycles, so we still need a manual focus call after the
  // motion entrance settles.
  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '60vh' }}
          >
            <CommandKit
              shouldFilter
              loop
              label={lang === 'en' ? 'Command palette' : 'Paleta de comandos'}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            >
              <div className="flex items-center gap-3 border-b border-slate-800 p-4">
                <Search size={20} className="text-slate-500" />
                <CommandKit.Input
                  ref={inputRef}
                  value={search}
                  onValueChange={setSearch}
                  placeholder={lang === 'en' ? 'Type a command...' : 'Escribe un comando...'}
                  className="flex-1 border-0 bg-transparent text-lg font-medium text-white outline-none placeholder:text-slate-600"
                />
                <div className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400">
                  ESC
                </div>
              </div>

              <CommandKit.List className="scrollbar-thin flex-1 overflow-y-auto p-2">
                <CommandKit.Empty>
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-500">
                    <Info size={24} className="opacity-20" />
                    <span>
                      {lang === 'en' ? 'No commands found' : 'No se encontraron comandos'}
                    </span>
                  </div>
                </CommandKit.Empty>
                {actions.map(action => (
                  <CommandKit.Item
                    key={action.id}
                    // value combines label + subLabel so the
                    // built-in fuzzy match scores against both — an
                    // operator typing "history" finds "Run history"
                    // (label) but also any sublabel that mentions it.
                    value={`${action.label} ${action.subLabel ?? ''}`}
                    onSelect={() => {
                      action.action();
                      onClose();
                    }}
                    className="data-[selected=true]:bg-primary group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-slate-300 transition-colors data-[selected=true]:text-white"
                  >
                    <div className="text-slate-500 group-data-[selected=true]:text-white">
                      {action.icon || <Command size={16} />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{action.label}</div>
                      {action.subLabel && (
                        <div className="group-data-[selected=true]:text-primary/20 text-[10px] text-slate-500">
                          {action.subLabel}
                        </div>
                      )}
                    </div>
                    {action.shortcut && <Shortcut keys={action.shortcut} />}
                    <ArrowRight
                      size={14}
                      className="opacity-0 transition-opacity group-data-[selected=true]:opacity-50"
                    />
                  </CommandKit.Item>
                ))}
              </CommandKit.List>

              <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 p-2 px-4 text-[10px] text-slate-500">
                <span>
                  <span className="font-bold">↑↓</span> {lang === 'en' ? 'Navigate' : 'Navegar'}
                </span>
                <span>
                  <span className="font-bold">↵</span> {lang === 'en' ? 'Select' : 'Seleccionar'}
                </span>
              </div>
            </CommandKit>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
