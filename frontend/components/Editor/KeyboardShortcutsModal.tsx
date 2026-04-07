
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: 'en' | 'es';
}

export default function KeyboardShortcutsModal({ isOpen, onClose, lang }: KeyboardShortcutsModalProps) {
    const text = {
        en: {
            title: 'Keyboard Shortcuts & Help',
            categories: {
                general: 'General Actions',
                nodes: 'Node Management',
                connections: 'Connections',
                navigation: 'Navigation',
                execution: 'Execution',
                selection: 'Selection'
            }
        },
        es: {
            title: 'Atajos de Teclado y Ayuda',
            categories: {
                general: 'Acciones Generales',
                nodes: 'Gestión de Nodos',
                connections: 'Conexiones',
                navigation: 'Navegación',
                execution: 'Ejecución',
                selection: 'Selección'
            }
        }
    }[lang];

    const shortcuts = [
        // General
        { cat: 'general', keys: ['Ctrl', 'Z'], desc: { en: 'Undo', es: 'Deshacer' } },
        { cat: 'general', keys: ['Ctrl', 'Shift', 'Z'], desc: { en: 'Redo', es: 'Rehacer' } },
        { cat: 'general', keys: ['Esc'], desc: { en: 'Deselect All / Cancel', es: 'Deseleccionar / Cancelar' } },

        // Selection
        { cat: 'selection', keys: ['Click'], desc: { en: 'Select Node', es: 'Seleccionar Nodo' } },
        { cat: 'selection', keys: ['Shift', 'Click'], desc: { en: 'Add to Selection', es: 'Añadir a Selección' } },
        { cat: 'selection', keys: ['Box Drag'], desc: { en: 'Area Selection', es: 'Selección de Área' } },

        // Nodes
        { cat: 'nodes', keys: ['Del'], desc: { en: 'Delete Selected', es: 'Eliminar Selección' } },
        { cat: 'nodes', keys: ['Ctrl', 'D'], desc: { en: 'Duplicate Selected', es: 'Duplicar Selección' } },
        { cat: 'nodes', keys: ['Ctrl', 'E'], desc: { en: 'Toggle Enable/Disable', es: 'Activar/Desactivar' } },
        { cat: 'nodes', keys: ['Arrows'], desc: { en: 'Nudge Node', es: 'Mover Nodo' } },

        // Navigation
        { cat: 'navigation', keys: ['Space', 'Drag'], desc: { en: 'Pan Canvas', es: 'Panear Lienzo' } },
        { cat: 'navigation', keys: ['Wheel'], desc: { en: 'Zoom In/Out', es: 'Zoom Acercar/Alejar' } },

        // Execution
        { cat: 'execution', keys: ['Ctrl', 'Enter'], desc: { en: 'Run Workflow', es: 'Ejecutar Flujo' } },
    ];

    const KeyCaps = ({ keys }: { keys: string[] }) => (
        <div className="flex gap-1">
            {keys.map((k, i) => (
                <span key={i} className="flex items-center">
                    <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded-md text-[10px] font-bold font-mono text-gray-300 min-w-[24px] text-center shadow-sm">
                        {k}
                    </kbd>
                    {i < keys.length - 1 && <span className="text-gray-500 mx-1 text-xs">+</span>}
                </span>
            ))}
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#1a1a2e] border border-gray-700 shadow-2xl rounded-lg w-[700px] h-[500px] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-[#16162a]">
                            <div className="flex items-center gap-2 text-white font-bold">
                                <Keyboard size={18} className="text-[var(--theme-color)]" />
                                {text.title}
                            </div>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                {/* Group by category logic visually simplified */}
                                {Object.entries(text.categories).map(([key, title]) => {
                                    const categoryShortcuts = shortcuts.filter(s => s.cat === key);
                                    if (categoryShortcuts.length === 0) return null;

                                    return (
                                        <div key={key} className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase text-[var(--highlight-color)] tracking-wider border-b border-white/10 pb-1 mb-2">
                                                {title}
                                            </h3>
                                            <div className="space-y-2">
                                                {categoryShortcuts.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between group">
                                                        <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
                                                            {s.desc[lang]}
                                                        </span>
                                                        <KeyCaps keys={s.keys} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-700 bg-black/20 text-center">
                            <p className="text-xs text-gray-500 italic">
                                NanoRun Editor v1.0 • Built for advanced workflow automation.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
