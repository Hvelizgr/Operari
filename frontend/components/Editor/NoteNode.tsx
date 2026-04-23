// frontend/components/Editor/NoteNode.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { WorkflowNode } from '@cairn/shared';

interface NoteNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
}

export default function NoteNode({ node, isSelected, onUpdate }: NoteNodeProps) {
  const [text, setText] = useState(node.config?.text || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setText(node.config?.text || '');
  }, [node.config?.text]);

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
        width: (node.config as any)?.width || 275,
        height: (node.config as any)?.height || 200,
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
