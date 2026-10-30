// Adapted from xyOps Workflow Editor
// Original: Copyright (c) 2019 - 2026 PixlCore LLC
// License: BSD 3-Clause (see xyOps LICENSE.md)
// Adapted for Operari

import { useCallback, useEffect, useState } from 'react';

import { isTypingTarget } from './useEditorKeyboard';

export type EditorTool = 'draw' | 'move';

export function useEditorTools() {
  const [tool, setTool] = useState<EditorTool>('move');

  useEffect(() => {
    const saved = localStorage.getItem('wf_tool');
    if (saved === 'draw' || saved === 'move') {
      setTool(saved as EditorTool);
    }
  }, []);

  const selectTool = useCallback((newTool: EditorTool) => {
    setTool(newTool);
    localStorage.setItem('wf_tool', newTool);
  }, []);

  const selectDrawTool = useCallback(() => {
    selectTool('draw');
  }, [selectTool]);

  const selectMoveTool = useCallback(() => {
    selectTool('move');
  }, [selectTool]);

  // Quick select move tool with space key (like xyOps)
  const quickSelectMoveTool = useCallback(() => {
    if (tool !== 'draw') return;

    const originalTool = tool;
    selectMoveTool();

    const handleKeyUp = () => {
      selectTool(originalTool);
      document.removeEventListener('keyup', handleKeyUp);
    };

    document.addEventListener('keyup', handleKeyUp);
  }, [tool, selectMoveTool, selectTool]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // D key for draw tool
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        selectDrawTool();
      }
      // M key for move tool
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        selectMoveTool();
      }
      // Space for quick move (hold)
      if (e.key === ' ' && !e.repeat) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        quickSelectMoveTool();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectDrawTool, selectMoveTool, quickSelectMoveTool]);

  return {
    tool,
    selectTool,
    selectDrawTool,
    selectMoveTool,
    quickSelectMoveTool,
    isDrawMode: tool === 'draw',
    isMoveMode: tool === 'move',
  };
}
