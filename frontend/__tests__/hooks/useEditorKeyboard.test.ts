import { renderHook } from '@testing-library/react';

import { useEditorKeyboard } from '../../hooks/useEditorKeyboard';

function setup() {
  const setDeleteConfirm = jest.fn();
  const setNodes = jest.fn();
  renderHook(() =>
    useEditorKeyboard({
      nodes: [{ id: 'n1', type: 'shell', title: 'n1', position: { x: 0, y: 0 } }],
      selectedNodes: new Set(['n1']),
      focusedNodeIndex: -1,
      selectedConnection: null,
      undo: jest.fn(),
      redo: jest.fn(),
      canUndo: false,
      canRedo: false,
      setSelectedNodes: jest.fn(),
      setFocusedNodeIndex: jest.fn(),
      setDeleteConfirm,
      setDeleteConnectionConfirm: jest.fn(),
      deleteConfirm: { open: false, nodeIds: [] },
      deleteConnectionConfirm: { open: false, connectionId: null },
      announceMessage: jest.fn(),
      setNodes,
    })
  );
  return { setDeleteConfirm, setNodes };
}

function press(target: EventTarget, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('useEditorKeyboard', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves Backspace and arrows alone while typing in a field', () => {
    const { setDeleteConfirm, setNodes } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);

    const backspace = press(input, 'Backspace');
    const arrow = press(input, 'ArrowLeft');

    expect(setDeleteConfirm).not.toHaveBeenCalled();
    expect(setNodes).not.toHaveBeenCalled();
    expect(backspace.defaultPrevented).toBe(false);
    expect(arrow.defaultPrevented).toBe(false);
  });

  it('asks to delete the selected node when Backspace hits the canvas', () => {
    const { setDeleteConfirm } = setup();
    press(document.body, 'Backspace');
    expect(setDeleteConfirm).toHaveBeenCalledWith({ open: true, nodeIds: ['n1'] });
  });
});
