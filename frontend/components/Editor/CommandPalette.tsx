'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, ArrowRight, Zap, Info } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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
    const filteredActions = actions.filter(action =>
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

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredActions, selectedIndex, onClose]);

    const Shortcut = ({ keys }: { keys: string[] }) => (
        <div className="flex gap-1 ml-4 op-60">
            {keys.map((k, i) => (
                <span key={i} className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-slate-400">
                    {k}
                </span>
            ))}
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[15vh]" onClick={onClose}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-xl bg-slate-900 border border-slate-700 shadow-2xl rounded-xl overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                        style={{ maxHeight: '60vh' }}
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                            <Search size={20} className="text-slate-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={lang === 'en' ? 'Type a command...' : 'Escribe un comando...'}
                                className="flex-1 bg-transparent text-lg text-white border-0 outline-none placeholder:text-slate-600 font-medium"
                            />
                            <div className="text-[10px] font-bold bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">ESC</div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                            {filteredActions.length > 0 ? (
                                filteredActions.map((action, index) => (
                                    <button
                                        key={action.id}
                                        onClick={() => {
                                            action.action();
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors
                                            ${index === selectedIndex ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800'}
                                        `}
                                    >
                                        <div className={`${index === selectedIndex ? 'text-white' : 'text-slate-500'}`}>
                                            {action.icon || <Command size={16} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{action.label}</div>
                                            {action.subLabel && (
                                                <div className={`text-[10px] ${index === selectedIndex ? 'text-primary/20' : 'text-slate-500'}`}>
                                                    {action.subLabel}
                                                </div>
                                            )}
                                        </div>
                                        {action.shortcut && <Shortcut keys={action.shortcut} />}
                                        {index === selectedIndex && <ArrowRight size={14} className="opacity-50" />}
                                    </button>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                                    <Info size={24} className="opacity-20" />
                                    <span>{lang === 'en' ? 'No commands found' : 'No se encontraron comandos'}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center text-[10px] text-slate-500 px-4">
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
