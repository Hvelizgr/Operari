'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

import { bannerVariants } from '@/lib/motion';

/**
 * Cheat-sheet modal for the app's keyboard-driven surfaces.
 *
 * Why this needs to exist: the ⌘K palette + the G-prefix nav (G H, G R,
 * G I, G S) + ⌘+Enter to run are all shipped but undiscoverable unless
 * the user stumbles into the palette and notices the shortcut hints.
 * A "?" hotkey + a visible row in the palette turns them into a
 * teachable feature.
 *
 * Keyboard: `?` (Shift+/) opens the modal; Escape closes it. Both
 * handled inside the component so the mount site only has to wire
 * isOpen/onClose state.
 */

interface Shortcut {
  keys: string[];
  label: string;
}

const isMac = () => {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
};

const STRINGS = {
  en: {
    title: 'Keyboard shortcuts',
    subtitle: 'All the keys. Works anywhere in the app.',
    close: 'Close',
    sections: {
      nav: 'Navigate',
      palette: 'Command palette',
      editor: 'Editor',
      global: 'Global',
    },
    labels: {
      openPalette: 'Open command palette',
      openHelp: 'Show this cheat sheet',
      goDashboard: 'Go to Dashboard',
      goRunbooks: 'Go to Runbooks',
      goRuns: 'Go to Run history',
      goInbox: 'Go to Inbox',
      goSql: 'Go to SQL editor',
      goHttpTester: 'Go to API tester',
      goMcpTester: 'Go to MCP tester',
      runCanvas: 'Run current runbook',
      saveCanvas: 'Save runbook',
      closeDialog: 'Close any dialog/palette',
    },
  },
  es: {
    title: 'Atajos de teclado',
    subtitle: 'Todos los atajos. Funcionan en toda la app.',
    close: 'Cerrar',
    sections: {
      nav: 'Navegar',
      palette: 'Paleta de comandos',
      editor: 'Editor',
      global: 'Global',
    },
    labels: {
      openPalette: 'Abrir paleta de comandos',
      openHelp: 'Ver este atajo',
      goDashboard: 'Ir al Panel',
      goRunbooks: 'Ir a Runbooks',
      goRuns: 'Ir al historial',
      goInbox: 'Ir a la bandeja',
      goSql: 'Ir al SQL editor',
      goHttpTester: 'Ir al probador de API',
      goMcpTester: 'Ir al probador MCP',
      runCanvas: 'Ejecutar runbook actual',
      saveCanvas: 'Guardar runbook',
      closeDialog: 'Cerrar diálogo/paleta',
    },
  },
} as const;

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
}

export default function ShortcutHelpModal({ isOpen, onClose, lang }: ShortcutHelpModalProps) {
  const t = STRINGS[lang];
  const mod = isMac() ? '⌘' : 'Ctrl';

  // Escape closes. Intentionally NOT mounted unless isOpen; otherwise
  // adding/removing the listener on every toggle is wasted work.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const sections: Array<{ title: string; rows: Shortcut[] }> = [
    {
      title: t.sections.palette,
      rows: [
        { keys: [mod, 'K'], label: t.labels.openPalette },
        { keys: ['?'], label: t.labels.openHelp },
      ],
    },
    {
      title: t.sections.nav,
      rows: [
        { keys: ['G', 'H'], label: t.labels.goDashboard },
        { keys: ['G', 'R'], label: t.labels.goRunbooks },
        { keys: ['G', 'I'], label: t.labels.goInbox },
        { keys: ['G', 'S'], label: t.labels.goSql },
        { keys: ['G', 'A'], label: t.labels.goHttpTester },
        { keys: ['G', 'M'], label: t.labels.goMcpTester },
      ],
    },
    {
      title: t.sections.editor,
      rows: [
        { keys: [mod, 'Enter'], label: t.labels.runCanvas },
        { keys: [mod, 'S'], label: t.labels.saveCanvas },
      ],
    },
    {
      title: t.sections.global,
      rows: [{ keys: ['Esc'], label: t.labels.closeDialog }],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
        >
          <motion.div
            variants={bannerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">{t.title}</h2>
                <p className="text-[11px] text-zinc-500">{t.subtitle}</p>
              </div>
              <button
                onClick={onClose}
                aria-label={t.close}
                className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/40"
              >
                <X size={16} />
              </button>
            </header>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
              {sections.map(section => (
                <section key={section.title}>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {section.title}
                  </h3>
                  <ul className="space-y-1.5">
                    {section.rows.map(row => (
                      <li
                        key={row.label}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"
                      >
                        <span className="min-w-0 text-zinc-300">{row.label}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {row.keys.map((k, i) => (
                            <kbd
                              key={i}
                              className="inline-flex min-w-[24px] items-center justify-center rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
