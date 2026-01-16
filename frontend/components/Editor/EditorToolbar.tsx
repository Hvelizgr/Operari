'use client';

import { Undo2, Redo2, Save, Zap, MousePointer2, Move, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Copy, Trash2, Power, History as HistoryIcon, Plus, Wand2, Bug, Unlink } from 'lucide-react';
import { useAccessibility } from '../../context/AccessibilityContext';
import type { SaveStatus } from '../../hooks/useAutosave';
import { CSSProperties } from 'react';

interface EditorToolbarProps {
    // ...
    // Save status
    saveStatus: SaveStatus;
    enableAutosave: boolean;
    setEnableAutosave: (enabled: boolean) => void;

    // Undo/Redo
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    undoDescription?: string;
    redoDescription?: string;

    // Language
    lang: 'en' | 'es';

    // Editor Mode
    editorMode: 'move' | 'connect';
    setEditorMode: (mode: 'move' | 'connect') => void;

    // Execution
    onExecute: () => void;
    isExecuting: boolean;
    onDebug?: () => void; // New

    // Selection Context
    selectedCount?: number;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleEnable?: () => void;
    onDetach?: () => void;
    onOpenShortcuts: () => void;
    onOpenHistory: () => void;
    onAddNode: () => void;
    onAutoLayout: () => void;
    style?: CSSProperties;
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
    editorMode,
    setEditorMode,
    onExecute,
    isExecuting,
    onDebug,
    selectedCount = 0,
    onDuplicate,
    onDelete,
    onToggleEnable,
    onDetach,
    onOpenShortcuts,
    onOpenHistory,
    onAddNode,
    onAutoLayout,
    undoDescription,
    redoDescription,
    style
}: EditorToolbarProps) {
    const { highContrast, toggleHighContrast } = useAccessibility();

    const undoTitle = (lang === 'en' ? 'Undo (Ctrl+Z)' : 'Deshacer (Ctrl+Z)') + (undoDescription ? `: ${undoDescription}` : '');
    const redoTitle = (lang === 'en' ? 'Redo (Ctrl+Y)' : 'Rehacer (Ctrl+Y)') + (redoDescription ? `: ${redoDescription}` : '');

    // Helper for Save Status
    const renderSaveStatus = () => {
        const config = {
            saving: { icon: Loader2, text: lang === 'en' ? 'Saving...' : 'Guardando...', color: 'var(--blue)' },
            saved: { icon: CheckCircle2, text: lang === 'en' ? 'Saved' : 'Guardado', color: 'var(--green)' },
            error: { icon: AlertCircle, text: lang === 'en' ? 'Error' : 'Error', color: 'var(--red)' },
            conflict: { icon: AlertCircle, text: lang === 'en' ? 'Conflict' : 'Conflicto', color: 'var(--orange)' },
        }[saveStatus];

        if (!config) return null;
        const Icon = config.icon;

        return (
            <div className="right" style={{ height: '30px', lineHeight: '30px', marginRight: '10px', display: 'flex', alignItems: 'center', color: config.color }}>
                <Icon size={14} className={saveStatus === 'saving' ? 'animate-spin' : ''} style={{ marginRight: '5px' }} />
                <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{config.text}</span>
            </div>
        );
    };

    return (
        <div className="wf_grid_header" style={style}>
            <div className="wf_title" style={{ paddingLeft: '14px' }}>
                {selectedCount > 0 ? (
                    <span style={{ color: 'var(--blue)', fontWeight: 'bold' }}>
                        {selectedCount} {lang === 'en' ? 'items selected' : 'elementos seleccionados'}
                    </span>
                ) : (
                    <>
                        <span style={{ marginRight: '5px' }}>⚡</span>
                        NANOFLOW EDITOR
                    </>
                )}
            </div>

            {/* Buttons float right, so first in DOM is right-most */}

            {/* --- SELECTION CONTEXT BUTTONS --- */}
            {selectedCount > 0 && (
                <>
                    {/* Delete */}
                    <div
                        className="button icon delete right"
                        onClick={onDelete}
                        title={lang === 'en' ? 'Delete Selected (Del)' : 'Eliminar Selección (Del)'}
                    >
                        <Trash2 size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    {/* Duplicate */}
                    <div
                        className="button icon right"
                        onClick={onDuplicate}
                        title={lang === 'en' ? 'Duplicate (Ctrl+D)' : 'Duplicar (Ctrl+D)'}
                    >
                        <Copy size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    {/* Enable/Disable */}
                    <div
                        className="button icon right"
                        onClick={onToggleEnable}
                        title={lang === 'en' ? 'Toggle Enable/Disable' : 'Activar/Desactivar'}
                    >
                        <Power size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    {/* Detach - Remove all connections */}
                    <div
                        className="button icon right"
                        onClick={onDetach}
                        title={lang === 'en' ? 'Detach (Remove all connections)' : 'Desconectar (Eliminar conexiones)'}
                    >
                        <Unlink size={16} style={{ transform: 'scale(1.2)' }} />
                    </div>

                    <div className="wf_button_separator right"></div>
                </>
            )}

            {/* Redo */}
            <div
                className={`button icon right ${!canRedo ? 'disabled' : ''}`}
                onClick={redo}
                title={redoTitle}
            >
                <Redo2 size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            {/* Undo */}
            <div
                className={`button icon right ${!canUndo ? 'disabled' : ''}`}
                onClick={undo}
                title={undoTitle}
            >
                <Undo2 size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            <div className="wf_button_separator right"></div>

            {/* Theme Toggle */}
            <div
                className={`button icon right ${highContrast ? 'selected' : ''}`}
                onClick={toggleHighContrast}
                title={highContrast ? (lang === 'en' ? 'Normal Mode' : 'Modo Normal') : (lang === 'en' ? 'High Contrast' : 'Alto Contraste')}
            >
                {highContrast ? <Eye size={16} style={{ transform: 'scale(1.2)' }} /> : <EyeOff size={16} style={{ transform: 'scale(1.2)' }} />}
            </div>

            {/* Autosave Toggle */}
            <div
                className={`button icon right ${enableAutosave ? 'selected' : ''}`}
                onClick={() => setEnableAutosave(!enableAutosave)}
                title={enableAutosave ? (lang === 'en' ? 'Autosave enabled' : 'Autoguardado activado') : (lang === 'en' ? 'Autosave disabled' : 'Autoguardado desactivado')}
            >
                <Save size={16} style={{ transform: 'scale(1.2)' }} />
            </div>

            <div className="wf_button_separator right"></div>

            {/* Save Status */}
            {renderSaveStatus()}

            <div className="wf_button_separator right"></div>

            {/* Debug Button */}
            {onDebug && (
                <>
                    <div
                        className={`button right ${isExecuting ? 'disabled' : ''}`}
                        onClick={onDebug}
                        title={lang === 'en' ? 'Debug Workflow' : 'Depurar Flujo'}
                    >
                        <Bug size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} className="text-orange-400" />
                        <span className="text-orange-400 font-bold">{lang === 'en' ? 'Debug' : 'Depurar'}</span>
                    </div>
                </>
            )}

            {/* Run Button */}
            <div
                className={`button right ${isExecuting ? 'disabled' : ''} ${!isExecuting ? 'primary' : ''}`}
                onClick={onExecute}
                title={lang === 'en' ? 'Run Workflow' : 'Ejecutar Flujo'}
            >
                <Zap size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} className={isExecuting ? 'animate-pulse' : ''} />
                <span>{isExecuting ? (lang === 'en' ? 'Running...' : 'Ejecutando...') : (lang === 'en' ? 'Run' : 'Ejecutar')}</span>
            </div>

            <div className="wf_button_separator right"></div>

            {/* Add Node Tool */}
            <div
                className="button right"
                onClick={onAddNode}
                title={lang === 'en' ? 'Add Node' : 'Agregar Nodo'}
            >
                <Plus size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
                <span>{lang === 'en' ? 'Add' : 'Agregar'}</span>
            </div>

            {/* Auto Layout */}
            <div
                className="button right"
                onClick={onAutoLayout}
                title={lang === 'en' ? 'Auto Layout' : 'Organizar'}
            >
                <Wand2 size={16} />
            </div>

            <div className="wf_button_separator right"></div>

            {/* Move Tool */}
            <div
                className={`button right ${editorMode === 'move' ? 'selected' : ''}`}
                onClick={() => setEditorMode('move')}
                title={lang === 'en' ? 'Move Tool (M)' : 'Herramienta Mover (M)'}
            >
                <Move size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
                <span>{lang === 'en' ? 'Move' : 'Mover'}</span>
            </div>

            {/* Draw Tool */}
            <div
                className={`button right ${editorMode === 'connect' ? 'selected' : ''}`}
                onClick={() => setEditorMode('connect')}
                title={lang === 'en' ? 'Draw Tool (D)' : 'Herramienta Dibujar (D)'}
            >
                <MousePointer2 size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
                <span>{lang === 'en' ? 'Draw' : 'Dibujar'}</span>
            </div>

            <div className="wf_button_separator right"></div>

            {/* Shortcuts / Help */}
            <div
                className="button icon right"
                onClick={onOpenShortcuts}
                title={lang === 'en' ? 'Keyboard Shortcuts (?)' : 'Atajos de Teclado (?)'}
            >
                <div className="font-bold text-xs border border-[var(--icon-color)] rounded-full w-4 h-4 flex items-center justify-center transform scale-90">?</div>
            </div>

            {/* History / Snapshots */}
            <div
                className="button icon right"
                onClick={onOpenHistory}
                title={lang === 'en' ? 'History / Snapshots' : 'Historial / Snapshots'}
            >
                <HistoryIcon size={16} />
            </div>

        </div>
    );
}
