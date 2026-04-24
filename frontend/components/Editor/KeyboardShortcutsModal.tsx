'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  lang,
}: KeyboardShortcutsModalProps) {
  const text = {
    en: {
      title: 'Keyboard Shortcuts & Help',
      categories: {
        general: 'General Actions',
        nodes: 'Node Management',
        connections: 'Connections',
        navigation: 'Navigation',
        execution: 'Execution',
        selection: 'Selection',
      },
    },
    es: {
      title: 'Atajos de Teclado y Ayuda',
      categories: {
        general: 'Acciones Generales',
        nodes: 'Gestión de Nodos',
        connections: 'Conexiones',
        navigation: 'Navegación',
        execution: 'Ejecución',
        selection: 'Selección',
      },
    },
  }[lang];

  const shortcuts = [
    // General
    { cat: 'general', keys: ['Ctrl', 'Z'], desc: { en: 'Undo', es: 'Deshacer' } },
    { cat: 'general', keys: ['Ctrl', 'Shift', 'Z'], desc: { en: 'Redo', es: 'Rehacer' } },
    {
      cat: 'general',
      keys: ['Esc'],
      desc: { en: 'Deselect All / Cancel', es: 'Deseleccionar / Cancelar' },
    },

    // Selection
    { cat: 'selection', keys: ['Click'], desc: { en: 'Select Node', es: 'Seleccionar Nodo' } },
    {
      cat: 'selection',
      keys: ['Shift', 'Click'],
      desc: { en: 'Add to Selection', es: 'Añadir a Selección' },
    },
    {
      cat: 'selection',
      keys: ['Box Drag'],
      desc: { en: 'Area Selection', es: 'Selección de Área' },
    },

    // Nodes
    { cat: 'nodes', keys: ['Del'], desc: { en: 'Delete Selected', es: 'Eliminar Selección' } },
    {
      cat: 'nodes',
      keys: ['Ctrl', 'D'],
      desc: { en: 'Duplicate Selected', es: 'Duplicar Selección' },
    },
    {
      cat: 'nodes',
      keys: ['Ctrl', 'E'],
      desc: { en: 'Toggle Enable/Disable', es: 'Activar/Desactivar' },
    },
    { cat: 'nodes', keys: ['Arrows'], desc: { en: 'Nudge Node', es: 'Mover Nodo' } },

    // Navigation
    { cat: 'navigation', keys: ['Space', 'Drag'], desc: { en: 'Pan Canvas', es: 'Panear Lienzo' } },
    { cat: 'navigation', keys: ['Wheel'], desc: { en: 'Zoom In/Out', es: 'Zoom Acercar/Alejar' } },

    // Execution
    {
      cat: 'execution',
      keys: ['Ctrl', 'Enter'],
      desc: { en: 'Run runbook', es: 'Ejecutar runbook' },
    },
  ];

  const KeyCaps = ({ keys }: { keys: string[] }) => (
    <div className="flex gap-1">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center">
          <kbd className="min-w-[24px] rounded-md border border-white/20 bg-white/10 px-2 py-1 text-center font-mono text-[10px] font-bold text-gray-300 shadow-sm">
            {k}
          </kbd>
          {i < keys.length - 1 && <span className="mx-1 text-xs text-gray-500">+</span>}
        </span>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex h-[500px] w-[700px] flex-col overflow-hidden rounded-lg border border-gray-700 bg-[#1a1a2e] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700 bg-[#16162a] p-4">
              <div className="flex items-center gap-2 font-bold text-white">
                <Keyboard size={18} className="text-[var(--theme-color)]" />
                {text.title}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 transition-colors hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {/* Group by category logic visually simplified */}
                {Object.entries(text.categories).map(([key, title]) => {
                  const categoryShortcuts = shortcuts.filter(s => s.cat === key);
                  if (categoryShortcuts.length === 0) return null;

                  return (
                    <div key={key} className="space-y-3">
                      <h3 className="mb-2 border-b border-white/10 pb-1 text-xs font-bold uppercase tracking-wider text-[var(--highlight-color)]">
                        {title}
                      </h3>
                      <div className="space-y-2">
                        {categoryShortcuts.map((s, i) => (
                          <div key={i} className="group flex items-center justify-between">
                            <span className="text-sm text-gray-400 transition-colors group-hover:text-gray-200">
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
            <div className="border-t border-gray-700 bg-black/20 p-4 text-center">
              <p className="text-xs italic text-gray-500">
                NanoRun Editor v1.0 • Built for advanced workflow automation.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
