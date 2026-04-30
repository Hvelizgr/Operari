'use client';

import { useEffect } from 'react';

import {
  buildSnapshot,
  copyToClipboard,
  readClipboardAsync,
  remapForPaste,
} from '@/lib/canvas/clipboard';
import { useEditorStore } from '@/state/editorStore';

const NUDGE_PX = 20;

const isEditableTarget = (el: EventTarget | null): boolean => {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const isMod = (e: KeyboardEvent): boolean => e.metaKey || e.ctrlKey;

export function useEditorKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const store = useEditorStore.getState();
      const selectedIds = store.nodes.filter(n => n.selected).map(n => n.id);

      // Undo / redo first because they shadow Ctrl+Y on some keymaps.
      if (isMod(e) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          useEditorStore.temporal.getState().redo();
        } else {
          useEditorStore.temporal.getState().undo();
        }
        e.preventDefault();
        return;
      }
      if (isMod(e) && (e.key === 'y' || e.key === 'Y')) {
        useEditorStore.temporal.getState().redo();
        e.preventDefault();
        return;
      }

      if (isMod(e) && (e.key === 'a' || e.key === 'A')) {
        useEditorStore.setState(s => ({
          nodes: s.nodes.map(n => (n.selected ? n : { ...n, selected: true })),
        }));
        e.preventDefault();
        return;
      }

      if (selectedIds.length === 0) return;

      if (isMod(e) && (e.key === 'c' || e.key === 'C')) {
        copyToClipboard(buildSnapshot(selectedIds, store.nodes, store.edges));
        e.preventDefault();
        return;
      }
      if (isMod(e) && (e.key === 'x' || e.key === 'X')) {
        copyToClipboard(buildSnapshot(selectedIds, store.nodes, store.edges));
        store.removeNodes(selectedIds);
        e.preventDefault();
        return;
      }
      if (isMod(e) && (e.key === 'v' || e.key === 'V')) {
        // Paste prefers the system clipboard (cross-tab) and falls
        // back to the in-memory snapshot if denied. The handler
        // becomes async after preventDefault so the keystroke isn't
        // double-handled by the browser.
        e.preventDefault();
        readClipboardAsync().then(snap => {
          if (!snap) return;
          const { nodes, edges } = remapForPaste(snap);
          useEditorStore.getState().appendForPaste(nodes, edges);
        });
        return;
      }
      if (isMod(e) && (e.key === 'd' || e.key === 'D')) {
        const { nodes, edges } = remapForPaste(
          buildSnapshot(selectedIds, store.nodes, store.edges)
        );
        store.appendForPaste(nodes, edges);
        e.preventDefault();
        return;
      }
      if (isMod(e) && (e.key === 'e' || e.key === 'E')) {
        for (const id of selectedIds) {
          const node = store.nodes.find(n => n.id === id);
          if (!node) continue;
          const enabled = node.data.workflow.enabled !== false;
          store.updateNodeData(id, {
            workflow: { ...node.data.workflow, enabled: !enabled },
          });
        }
        store.setStatus('dirty');
        e.preventDefault();
        return;
      }

      // Arrow nudge by one grid cell.
      const dx = e.key === 'ArrowLeft' ? -NUDGE_PX : e.key === 'ArrowRight' ? NUDGE_PX : 0;
      const dy = e.key === 'ArrowUp' ? -NUDGE_PX : e.key === 'ArrowDown' ? NUDGE_PX : 0;
      if (dx !== 0 || dy !== 0) {
        useEditorStore.setState(s => ({
          nodes: s.nodes.map(n =>
            n.selected ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n
          ),
          status: 'dirty',
        }));
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
