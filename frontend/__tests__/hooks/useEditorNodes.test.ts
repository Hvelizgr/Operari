import { renderHook, act } from '@testing-library/react';
import { useEditorNodes } from '../../hooks/useEditorNodes';
import { INITIAL_NODES } from '../../constants/editor.constants';

describe('useEditorNodes', () => {
  const mockExecuteCommand = jest.fn(cmd => cmd.execute());

  beforeEach(() => {
    mockExecuteCommand.mockClear();
  });

  it('initializes with default nodes', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));
    expect(result.current.nodes).toEqual(INITIAL_NODES);
    expect(result.current.selectedNodes.size).toBe(0);
  });

  it('handles node selection', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));
    const nodeId = 'node-1';

    act(() => {
      result.current.handleNodeSelect(nodeId, false);
    });

    expect(result.current.selectedNodes.has(nodeId)).toBe(true);
    expect(result.current.selectedNodes.size).toBe(1);

    // Deselect or select another (single select)
    const nodeId2 = 'node-2';
    act(() => {
      result.current.handleNodeSelect(nodeId2, false);
    });
    expect(result.current.selectedNodes.has(nodeId)).toBe(false);
    expect(result.current.selectedNodes.has(nodeId2)).toBe(true);
  });

  it('handles multi-selection with shift key', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));
    const nodeId1 = 'node-1';
    const nodeId2 = 'node-2';

    act(() => {
      result.current.handleNodeSelect(nodeId1, false);
    });

    act(() => {
      result.current.handleNodeSelect(nodeId2, true); // Shift pressed
    });

    expect(result.current.selectedNodes.has(nodeId1)).toBe(true);
    expect(result.current.selectedNodes.has(nodeId2)).toBe(true);
    expect(result.current.selectedNodes.size).toBe(2);
  });

  it('handles node updates via executeCommand', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));

    // Assume INITIAL_NODES has at least one node, or we rely on the mock state.
    // Ideally we should inject nodes, but the hook initializes with INITIAL_NODES constant.
    // Let's modify a node that exists in INITIAL_NODES: 'node-start'
    const targetId = INITIAL_NODES[0].id;
    const newPosition = { x: 500, y: 500 };

    act(() => {
      result.current.handleNodeUpdate(targetId, { position: newPosition });
    });

    expect(mockExecuteCommand).toHaveBeenCalled();
    const updatedNode = result.current.nodes.find(n => n.id === targetId);
    expect(updatedNode?.position).toEqual(newPosition);
  });

  it('handles node movement', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));
    const targetId = INITIAL_NODES[0].id;
    const initialY = INITIAL_NODES[0].position.y;

    act(() => {
      result.current.handleNodeMove(targetId, 'down');
    });

    // 20 is the hardcoded MOVE_STEP in the hook we saw
    const updatedNode = result.current.nodes.find(n => n.id === targetId);
    expect(updatedNode?.position.y).toBe(initialY + 20);
  });

  it('handles highlighting nodes', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));
    const ids = ['node-1', 'node-2'];

    act(() => {
      result.current.handleHighlightNodes(ids);
    });

    expect(result.current.highlightedNodes).toEqual(ids);
  });

  it('handles drag state', () => {
    const { result } = renderHook(() => useEditorNodes({ executeCommand: mockExecuteCommand }));

    act(() => {
      result.current.setDraggingNode('node-1');
    });

    expect(result.current.draggingNode).toBe('node-1');
  });
});
