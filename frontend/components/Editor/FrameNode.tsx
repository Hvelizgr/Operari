// frontend/components/Editor/FrameNode.tsx
'use client';

import type { WorkflowNode } from '@cairn/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

interface FrameNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  zoom?: number;
  /** How many non-frame, non-note steps are visually contained inside
   * this frame's bounding box. Computed once in NodesLayer and passed
   * down so the frame can render a "N steps" pill without walking the
   * node list itself. */
  containedCount?: number;
}

export default function FrameNode({
  node,
  isSelected,
  onUpdate,
  onDragStart,
  zoom = 1,
  containedCount = 0,
}: FrameNodeProps) {
  const [title, setTitle] = useState((node.config as any)?.title || 'Frame');
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    corner: string;
  } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Frame dimensions with defaults
  const width = (node.config as any)?.width || 400;
  const height = (node.config as any)?.height || 300;
  const color = (node.config as any)?.color || '#3ecf8e';

  // Sync title from config
  useEffect(() => {
    setTitle((node.config as any)?.title || 'Frame');
  }, [(node.config as any)?.title]);

  const handleTitleBlur = () => {
    setIsEditing(false);
    onUpdate(node.id, { config: { ...node.config, title } });
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleBlur();
    }
    if (e.key === 'Escape') {
      setTitle((node.config as any)?.title || 'Frame');
      setIsEditing(false);
    }
  };

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, corner: string) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: width,
        startH: height,
        corner,
      };
    },
    [width, height]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;

      const { startX, startY, startW, startH, corner } = resizeRef.current;
      const deltaX = (e.clientX - startX) / zoom;
      const deltaY = (e.clientY - startY) / zoom;

      let newWidth = startW;
      let newHeight = startH;

      if (corner.includes('e')) newWidth = Math.max(200, startW + deltaX);
      if (corner.includes('w')) newWidth = Math.max(200, startW - deltaX);
      if (corner.includes('s')) newHeight = Math.max(150, startH + deltaY);
      if (corner.includes('n')) newHeight = Math.max(150, startH - deltaY);

      onUpdate(node.id, {
        config: {
          ...node.config,
          width: newWidth,
          height: newHeight,
        },
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, zoom, node.id, node.config, onUpdate]);

  return (
    <div
      ref={frameRef}
      id={`d_wfn_${node.id}`}
      className={`wf_node wf_frame ${isSelected ? 'selected' : ''}`}
      style={
        {
          left: node.position.x,
          top: node.position.y,
          width,
          height,
          '--frame-color': color,
        } as React.CSSProperties
      }
    >
      {/* Title Bar - Draggable */}
      <div
        className="frame-title-bar"
        onMouseDown={e => {
          e.stopPropagation();
          onDragStart(node.id, e);
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ opacity: 0.5 }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
        {isEditing ? (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            className="frame-title-input"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="frame-title">{title}</span>
        )}
        {containedCount > 0 && (
          <span className="frame-count-badge" title={`${containedCount} steps inside`}>
            {containedCount}
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="frame-content" />

      {/* Resize Handles */}
      <div className="frame-resize-handle se" onMouseDown={e => handleResizeStart(e, 'se')} />
      <div className="frame-resize-handle sw" onMouseDown={e => handleResizeStart(e, 'sw')} />
      <div className="frame-resize-handle ne" onMouseDown={e => handleResizeStart(e, 'ne')} />
      <div className="frame-resize-handle nw" onMouseDown={e => handleResizeStart(e, 'nw')} />
      <div className="frame-resize-handle e" onMouseDown={e => handleResizeStart(e, 'e')} />
      <div className="frame-resize-handle w" onMouseDown={e => handleResizeStart(e, 'w')} />
      <div className="frame-resize-handle s" onMouseDown={e => handleResizeStart(e, 's')} />
      <div className="frame-resize-handle n" onMouseDown={e => handleResizeStart(e, 'n')} />
    </div>
  );
}
