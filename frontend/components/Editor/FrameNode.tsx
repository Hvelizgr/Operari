// frontend/components/Editor/FrameNode.tsx
'use client';

import type { FrameNodeConfig, WorkflowNode } from '@operari/shared';
import { NodeResizer } from '@xyflow/react';
import { useEffect, useState } from 'react';

interface FrameNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  /** How many non-frame, non-note steps are visually contained inside
   * this frame's bounding box. Computed once in FlowCanvas and passed
   * down so the frame can render a "N steps" pill without walking the
   * node list itself. */
  containedCount?: number;
}

export default function FrameNode({
  node,
  isSelected,
  onUpdate,
  containedCount = 0,
}: FrameNodeProps) {
  // FrameNode is only rendered for node.type === 'custom.frame' (see
  // FlowCanvas), so treating the config as FrameNodeConfig is safe.
  const cfg = (node.config ?? {}) as FrameNodeConfig;
  const [title, setTitle] = useState(cfg.title || 'Frame');
  const [isEditing, setIsEditing] = useState(false);

  // Frame dimensions with defaults
  const width = cfg.width || 400;
  const height = cfg.height || 300;
  const color = cfg.color || '#3ecf8e';

  // Sync title from config
  useEffect(() => {
    setTitle(cfg.title || 'Frame');
  }, [cfg.title]);

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
      setTitle(cfg.title || 'Frame');
      setIsEditing(false);
    }
  };

  return (
    <div
      id={`d_wfn_${node.id}`}
      className={`wf_node wf_frame ${isSelected ? 'selected' : ''}`}
      style={
        {
          width,
          height,
          '--frame-color': color,
        } as React.CSSProperties
      }
    >
      <NodeResizer isVisible={isSelected} minWidth={200} minHeight={150} color={color} />

      <div
        className="frame-title-bar"
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
            className="frame-title-input nodrag"
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

      <div className="frame-content" />
    </div>
  );
}
