'use client';

import {
  Copy,
  History as HistoryIcon,
  Keyboard,
  MousePointer2,
  Move,
  Power,
  Redo2,
  Trash2,
  Undo2,
  Unlink,
} from 'lucide-react';
import { CSSProperties } from 'react';

interface EditorToolbarProps {
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

  // Selection Context
  selectedCount?: number;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onToggleEnable?: () => void;
  onDetach?: () => void;
  onOpenShortcuts: () => void;
  onOpenHistory: () => void;
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
  selectedCount = 0,
  onDuplicate,
  onDelete,
  onToggleEnable,
  onDetach,
  onOpenShortcuts,
  onOpenHistory,
  style,
}: EditorToolbarProps) {
  const undoTitle =
    (lang === 'en' ? 'Undo (Ctrl+Z)' : 'Deshacer (Ctrl+Z)') +
    (undoDescription ? `: ${undoDescription}` : '');
  const redoTitle =
    (lang === 'en' ? 'Redo (Ctrl+Y)' : 'Rehacer (Ctrl+Y)') +
    (redoDescription ? `: ${redoDescription}` : '');

  return (
    <div className="wf_grid_header" style={style}>
      {/* Left: Title / Selection Info */}
      <div className="wf_title" style={{ paddingLeft: '14px' }}>
        {selectedCount > 0 ? (
          <span style={{ color: 'var(--blue)', fontWeight: 'bold' }}>
            {selectedCount} {lang === 'en' ? 'selected' : 'seleccionados'}
          </span>
        ) : (
          <span
            style={{
              opacity: 0.7,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
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
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDelete?.(); } }}
            title={lang === 'en' ? 'Delete (Del)' : 'Eliminar (Del)'}
          >
            <Trash2 size={16} style={{ transform: 'scale(1.2)' }} />
          </div>

          <div
            className="button icon right"
            onClick={onDuplicate}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDuplicate?.(); } }}
            title={lang === 'en' ? 'Duplicate (Ctrl+D)' : 'Duplicar (Ctrl+D)'}
          >
            <Copy size={16} style={{ transform: 'scale(1.2)' }} />
          </div>

          <div
            className="button icon right"
            onClick={onToggleEnable}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleEnable?.(); } }}
            title={lang === 'en' ? 'Toggle Enable' : 'Activar/Desactivar'}
          >
            <Power size={16} style={{ transform: 'scale(1.2)' }} />
          </div>

          <div
            className="button icon right"
            onClick={onDetach}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDetach?.(); } }}
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
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); redo(); } }}
        title={redoTitle}
      >
        <Redo2 size={16} style={{ transform: 'scale(1.2)' }} />
      </div>

      <div
        className={`button icon right ${!canUndo ? 'disabled' : ''}`}
        onClick={undo}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); undo(); } }}
        title={undoTitle}
      >
        <Undo2 size={16} style={{ transform: 'scale(1.2)' }} />
      </div>

      <div className="wf_button_separator right"></div>

      {/* --- GROUP 3: EDITOR MODE (Move, Draw) --- */}
      <div
        className={`button right ${editorMode === 'move' ? 'selected' : ''}`}
        onClick={() => setEditorMode('move')}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditorMode('move'); } }}
        title={lang === 'en' ? 'Move Tool (M)' : 'Mover (M)'}
      >
        <Move size={16} style={{ marginRight: '4px', transform: 'scale(1.2)' }} />
        <span>{lang === 'en' ? 'Move' : 'Mover'}</span>
      </div>

      <div
        className={`button right ${editorMode === 'connect' ? 'selected' : ''}`}
        onClick={() => setEditorMode('connect')}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditorMode('connect'); } }}
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
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenShortcuts(); } }}
        title={lang === 'en' ? 'Shortcuts (?)' : 'Atajos (?)'}
      >
        <Keyboard size={16} style={{ transform: 'scale(1.2)' }} />
      </div>

      <div
        className="button icon right"
        onClick={onOpenHistory}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenHistory(); } }}
        title={lang === 'en' ? 'History' : 'Historial'}
      >
        <HistoryIcon size={16} style={{ transform: 'scale(1.2)' }} />
      </div>
    </div>
  );
}
