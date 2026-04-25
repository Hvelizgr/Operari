// frontend/components/Editor/NoteNode.tsx
'use client';

import type { NoteNodeConfig, WorkflowNode } from '@nanorun/shared';
import { useEffect, useState } from 'react';

interface NoteNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
}

export default function NoteNode({ node, isSelected, onUpdate }: NoteNodeProps) {
  // NoteNode is only rendered when node.type === 'custom.note' (see
  // NodesLayer), so treating the config as NoteNodeConfig is safe.
  const cfg = (node.config ?? {}) as NoteNodeConfig;
  const [text, setText] = useState(cfg.text || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setText(cfg.text || '');
  }, [cfg.text]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate(node.id, { config: { ...node.config, text } });
  };

  return (
    <div
      id={`d_wfn_${node.id}`}
      className={`wf_node wf_note ${isSelected ? 'selected' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: cfg.width || 275,
        height: cfg.height || 200,
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {isEditing ? (
        <textarea
          value={text}
          onChange={handleTextChange}
          onBlur={handleBlur}
          autoFocus
          className="h-full w-full resize-none bg-transparent p-2 font-mono text-xs focus:outline-none"
          style={{ color: 'var(--body-text-color)' }}
        />
      ) : (
        <div
          className="h-full w-full overflow-hidden whitespace-pre-wrap p-2 font-mono text-xs"
          style={{ color: 'var(--body-text-color)' }}
        >
          {text || 'Double click to edit note...'}
        </div>
      )}
    </div>
  );
}
