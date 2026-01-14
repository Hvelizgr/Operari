'use client';

import { Undo2, Redo2, Save } from 'lucide-react';
import SaveStatusIndicator from './SaveStatusIndicator';
import ThemeToggle from './ThemeToggle';
import type { SaveStatus } from '../hooks/useAutosave';

interface EditorToolbarProps {
    // Save status
    saveStatus: SaveStatus;
    enableAutosave: boolean;
    setEnableAutosave: (enabled: boolean) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Language
    lang: 'en' | 'es';
}

export default function EditorToolbar({
    saveStatus,
    enableAutosave,
    setEnableAutosave,
    undo,
    redo,
    canUndo,
    canRedo,
    lang,
}: EditorToolbarProps) {
    return (
        <div className="absolute top-4 right-4 flex items-center gap-2 z-40">
            <SaveStatusIndicator saveStatus={saveStatus} lang={lang} />

            <button
                onClick={() => setEnableAutosave(!enableAutosave)}
                className={`p-2 ${enableAutosave ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-900/50'} text-slate-200 rounded-lg transition-colors shadow-lg border border-slate-700`}
                title={enableAutosave ? (lang === 'en' ? 'Autosave enabled' : 'Autoguardado activado') : (lang === 'en' ? 'Autosave disabled' : 'Autoguardado desactivado')}
            >
                <Save size={18} className={enableAutosave ? '' : 'opacity-40'} />
            </button>

            <ThemeToggle lang={lang} />

            <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg transition-colors shadow-lg border border-slate-700"
                title="Undo (Ctrl+Z)"
            >
                <Undo2 size={18} />
            </button>

            <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 rounded-lg transition-colors shadow-lg border border-slate-700"
                title="Redo (Ctrl+Y)"
            >
                <Redo2 size={18} />
            </button>
        </div>
    );
}
