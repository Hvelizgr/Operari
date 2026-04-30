'use client';

import { type NodeProps, NodeResizer } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';

import type { RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

import { NodeContextToolbar } from '../NodeContextToolbar';

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 220;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 140;
const DEFAULT_COLOR = 'var(--op-sky)';

function FrameNodeComponent({ id, data, selected, parentId }: NodeProps<RfNode>) {
  const config = (data.workflow.config ?? {}) as {
    title?: string;
    color?: string;
    width?: number;
    height?: number;
  };
  const title = data.workflow.title?.trim() || config.title || 'Section';
  const color = config.color ?? DEFAULT_COLOR;
  const width = config.width ?? DEFAULT_WIDTH;
  const height = config.height ?? DEFAULT_HEIGHT;

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitTitle = () => {
    const next = draftTitle.trim() || title;
    if (next !== title) {
      useEditorStore.getState().updateNodeData(id, {
        workflow: { ...data.workflow, title: next },
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

  // CSS color-mix lets the frame tint pull from the brand `--op-*` tokens
  // when the user has not picked an explicit hex color.
  const fillTint =
    color.startsWith('var(') || color.startsWith('--')
      ? `color-mix(in oklab, ${color} 12%, transparent)`
      : `${color}1F`;

  return (
    <>
      <NodeContextToolbar id={id} kind="frame" parentId={parentId} />
      <NodeResizer
        color={color}
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        onResizeEnd={handleResize}
      />
      <div
        role="region"
        aria-label={`Frame: ${title}`}
        className="h-full w-full rounded-2xl border-2 backdrop-blur-sm transition-shadow"
        style={{
          width,
          height,
          background: fillTint,
          borderColor: color,
          boxShadow: selected
            ? `0 0 0 2px color-mix(in oklab, ${color} 35%, transparent)`
            : undefined,
        }}
      >
        <div
          className="rounded-t-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
          style={{ background: color }}
          onDoubleClick={e => {
            e.stopPropagation();
            setDraftTitle(title);
            setEditing(true);
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full bg-transparent text-xs font-semibold uppercase tracking-wide text-white focus:outline-none"
            />
          ) : (
            title
          )}
        </div>
      </div>
    </>
  );
}

export const FrameNode = memo(FrameNodeComponent);
