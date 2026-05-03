'use client';

import { type NodeProps, NodeResizer } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';

import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NodeContextToolbar } from '../NodeContextToolbar';

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 100;
const MIN_WIDTH = 160;
const MIN_HEIGHT = 60;
const DEFAULT_COLOR = 'var(--op-gold)';

interface NoteConfig {
  text?: string;
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Sticky-note node with the same author affordances n8n ships:
 * resize via NodeResizer, color from a palette in the context
 * toolbar, and inline edit on double-click. The stored shape lives
 * under `workflow.config` (text + color + width + height) so YAML
 * round-trip surfaces all of it without a schema change.
 */
function NoteNodeComponent({ id, data, selected, parentId }: NodeProps<RfNode>) {
  const config = (data.workflow.config ?? {}) as NoteConfig;
  const text = config.text || data.workflow.title || 'Note';
  const color = config.color ?? DEFAULT_COLOR;
  const width = config.width ?? DEFAULT_WIDTH;
  const height = config.height ?? DEFAULT_HEIGHT;

  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [editing]);

  // Keep draft in sync if external updates land while not editing
  // (e.g. paste-replace, undo).
  useEffect(() => {
    if (!editing) setDraftText(text);
  }, [text, editing]);

  const commitText = () => {
    const next = draftText.trim();
    if (next !== text) {
      useEditorStore.getState().updateNodeData(id, {
        workflow: { ...data.workflow, config: { ...config, text: next } },
      });
      useEditorStore.getState().setStatus('dirty');
    }
    setEditing(false);
  };

  const handleResize = (_event: unknown, params: { width: number; height: number }) => {
    useEditorStore.getState().updateNodeData(id, {
      workflow: {
        ...data.workflow,
        config: { ...config, width: params.width, height: params.height },
      },
    });
    useEditorStore.getState().setStatus('dirty');
  };

  // Translate the chosen palette token / hex into a soft tint
  // background (~18% opacity blend onto the panel surface). Same
  // helper FrameNode uses so the visual languages stay aligned.
  const fillTint =
    color.startsWith('var(') || color.startsWith('--')
      ? `color-mix(in oklab, ${color} 18%, var(--op-snow))`
      : `${color}2E`;
  const borderTint = selected
    ? color
    : color.startsWith('var(') || color.startsWith('--')
      ? `color-mix(in oklab, ${color} 35%, transparent)`
      : `${color}59`;
  // The inline text colour rides off the palette so dark notes stay
  // readable. `color-mix … 70% black` approximates a high-contrast
  // ink on the lighter tint.
  const inkColor =
    color.startsWith('var(') || color.startsWith('--')
      ? `color-mix(in oklab, ${color} 70%, black)`
      : color;

  return (
    <>
      <NodeContextToolbar id={id} kind="note" parentId={parentId} />
      <NodeResizer
        color={color}
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        onResizeEnd={handleResize}
      />
      <div
        role="note"
        aria-label={`Note: ${text}`}
        onDoubleClick={e => {
          e.stopPropagation();
          setDraftText(text);
          setEditing(true);
        }}
        className="rounded-lg border px-3 py-2 text-sm shadow-md"
        style={{
          width,
          height,
          background: fillTint,
          color: inkColor,
          borderColor: borderTint,
          boxShadow: selected
            ? `0 0 0 2px color-mix(in oklab, ${color} 50%, transparent)`
            : undefined,
        }}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            onBlur={commitText}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commitText();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(false);
                setDraftText(text);
              }
            }}
            className="h-full w-full resize-none whitespace-pre-wrap break-words bg-transparent outline-none"
            style={{ color: inkColor }}
            placeholder="Write a note…"
          />
        ) : (
          <div className="h-full w-full overflow-hidden whitespace-pre-wrap break-words">
            {text}
          </div>
        )}
      </div>
    </>
  );
}

export const NoteNode = memo(NoteNodeComponent);
