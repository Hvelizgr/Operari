'use client';

import { Undo2, Redo2, MousePointer2, Move, Copy, Trash2, Power, History as HistoryIcon, Unlink, Keyboard, Target, FileText, BrainCircuit, Loader2 } from 'lucide-react';
import { CSSProperties } from 'react';

type BlastRadiusMode = 'off' | 'downstream' | 'upstream' | 'both';

interface EditorToolbarProps {
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    undoDescription?: string;
    redoDescription?: string;
    lang: 'en' | 'es';
    editorMode: 'select' | 'pan' | 'move' | 'connect';
    setEditorMode: (mode: 'select' | 'pan' | 'move' | 'connect') => void;
    blastRadiusMode?: BlastRadiusMode;
    onToggleBlastRadius?: () => void;
    selectedCount?: number;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleEnable?: () => void;
    onDetach?: () => void;
    onOpenShortcuts: () => void;
    onOpenHistory: () => void;
    onGenerateDocs?: () => void;
    onRunAIAnalysis?: () => void;
    isAILoading?: boolean;
    style?: CSSProperties;
}

export default function EditorToolbar({
    undo,
    redo,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    lang,
    editorMode,
    setEditorMode,
    blastRadiusMode = 'off',
    onToggleBlastRadius,
    selectedCount = 0,
    onDuplicate,
    onDelete,
    onToggleEnable,
    onDetach,
    onOpenShortcuts,
    onOpenHistory,
    onGenerateDocs,
    onRunAIAnalysis,
    isAILoading = false,
    style
}: EditorToolbarProps) {

    const undoTitle = (lang === 'en' ? 'Undo (Ctrl+Z)' : 'Deshacer (Ctrl+Z)') + (undoDescription ? `: ${undoDescription}` : '');
    const redoTitle = (lang === 'en' ? 'Redo (Ctrl+Y)' : 'Rehacer (Ctrl+Y)') + (redoDescription ? `: ${redoDescription}` : '');

    return (
        <div className="wf_grid_header" style={style}>
            {/* Left: Title / Selection Info */}
            <div className="wf_title" style={{ paddingLeft: '14px' }}>
                {selectedCount > 0 ? (
                    <span style={{ color: 'var(--blue)', fontWeight: 'bold' }}>
                        {selectedCount} {lang === 'en' ? 'selected' : 'seleccionados'}
                    </span>
                ) : (
                    <span style={{ opacity: 0.7, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {lang === 'en' ? 'Tools' : 'Herramientas'}
                    </span>
                )}
            </div>

            {/* Buttons float right, so first in DOM is right-most */}

            {/* --- GROUP 1: SELECTION ACTIONS (rightmost when visible) --- */}
            {selectedCount > 0 && (
                <>
                    <div
                        className="button icon delete right"
                        onClick={onDelete}
                        title={lang === 'en' ? 'Delete (Del)' : 'Eliminar (Del)'}
                    >
                        <Trash2 size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    <div
                        className="button icon right"
                        onClick={onDuplicate}
                        title={lang === 'en' ? 'Duplicate (Ctrl+D)' : 'Duplicar (Ctrl+D)'}
                    >
                        <Copy size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    <div
                        className="button icon right"
                        onClick={onToggleEnable}
                        title={lang === 'en' ? 'Toggle Enable' : 'Activar/Desactivar'}
                    >
                        <Power size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    <div
                        className="button icon right"
                        onClick={onDetach}
                        title={lang === 'en' ? 'Detach' : 'Desconectar'}
                    >
                        <Unlink size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    <div className="wf_button_separator right"></div>
                </>
            )}

            {/* --- GROUP 2: UNDO/REDO --- */}
            <div
                className={`button icon right ${!canRedo ? 'disabled' : ''}`}
                onClick={redo}
                title={redoTitle}
            >
                <Redo2 size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            <div
                className={`button icon right ${!canUndo ? 'disabled' : ''}`}
                onClick={undo}
                title={undoTitle}
            >
                <Undo2 size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            <div className="wf_button_separator right"></div>

            {/* --- GROUP 3: EDITOR MODE (Move, Draw) --- */}
            <div
                className={`button right ${editorMode === 'move' ? 'selected' : ''}`}
                onClick={() => setEditorMode('move')}
                title={lang === 'en' ? 'Move Tool (M)' : 'Mover (M)'}
            >
                <Move size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
                <span>{lang === 'en' ? 'Move' : 'Mover'}</span>
            </div>

            <div
                className={`button right ${editorMode === 'connect' ? 'selected' : ''}`}
                onClick={() => setEditorMode('connect')}
                title={lang === 'en' ? 'Draw Tool (D)' : 'Dibujar (D)'}
            >
                <MousePointer2 size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
                <span>{lang === 'en' ? 'Draw' : 'Dibujar'}</span>
            </div>

            <div className="wf_button_separator right"></div>

            {/* --- GROUP 4: UTILITY (History, Shortcuts) --- */}
            <div
                className="button icon right"
                onClick={onOpenShortcuts}
                title={lang === 'en' ? 'Shortcuts (?)' : 'Atajos (?)'}
            >
                <Keyboard size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            <div
                className="button icon right"
                onClick={onOpenHistory}
                title={lang === 'en' ? 'History' : 'Historial'}
            >
                <HistoryIcon size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            <div className="wf_button_separator right"></div>

            {/* --- GROUP 5: BLAST RADIUS (Impact Analysis) --- */}
            <div
                className={`button right ${blastRadiusMode !== 'off' ? 'primary' : ''}`}
                onClick={onToggleBlastRadius}
                title={
                    lang === 'en'
                        ? `Impact Analysis (${blastRadiusMode === 'off' ? 'Off' : blastRadiusMode === 'downstream' ? 'Downstream' : blastRadiusMode === 'upstream' ? 'Upstream' : 'Both'})`
                        : `Análisis de Impacto (${blastRadiusMode === 'off' ? 'Apagado' : blastRadiusMode === 'downstream' ? 'Descendente' : blastRadiusMode === 'upstream' ? 'Ascendente' : 'Ambos'})`
                }
            >
                <Target size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
                <span>
                    {blastRadiusMode === 'off'
                        ? (lang === 'en' ? 'Impact' : 'Impacto')
                        : blastRadiusMode === 'downstream'
                            ? (lang === 'en' ? 'Downstream' : 'Desc.')
                            : blastRadiusMode === 'upstream'
                                ? (lang === 'en' ? 'Upstream' : 'Asc.')
                                : (lang === 'en' ? 'Both' : 'Ambos')}
                </span>
            </div>

            <div className="wf_button_separator right"></div>

            {/* --- GROUP 6: AI INTELLIGENCE --- */}
            <div
                className={`button right ${isAILoading ? 'disabled' : ''}`}
                onClick={onRunAIAnalysis}
                title={lang === 'en' ? 'AI Workflow Analysis' : 'Análisis de Workflow con IA'}
            >
                {isAILoading ? <Loader2 size={16} className="animate-spin mr-1" /> : <BrainCircuit size={16} className="mr-1" />}
                <span>{lang === 'en' ? 'AI Analysis' : 'Análisis IA'}</span>
            </div>

            <div
                className={`button right ${isAILoading ? 'disabled' : ''}`}
                onClick={onGenerateDocs}
                title={lang === 'en' ? 'Generate AI Documentation' : 'Generar Documentación con IA'}
            >
                {isAILoading ? <Loader2 size={16} className="animate-spin mr-1" /> : <FileText size={16} className="mr-1" />}
                <span>{lang === 'en' ? 'AI Doc' : 'Doc IA'}</span>
            </div>
        </div>
    );
}