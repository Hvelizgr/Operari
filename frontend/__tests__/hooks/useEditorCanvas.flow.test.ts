import type { WorkflowNode } from '@operari/shared';
import type { NodeChange } from '@xyflow/react';
import { act, renderHook } from '@testing-library/react';

import { useEditorCanvas } from '../../hooks/useEditorCanvas';

jest.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    fitView: jest.fn(),
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    setViewport: jest.fn(),
    setCenter: jest.fn(),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  }),
}));
jest.mock('../../hooks/useNodeTypes', () => ({
  useNodeTypes: () => ({ nodeTypes: [], loading: false, error: null }),
}));
jest.mock('../../context/AccessibilityContext', () => ({
  useAccessibility: () => ({ highContrast: false, announceMessage: jest.fn() }),
}));
jest.mock('../../hooks/useAutosave', () => ({
  useAutosave: () => ({ saveStatus: 'saved', enableAutosave: false, setEnableAutosave: jest.fn() }),
}));

const shell = (id: string, x: number, y: number, parentId?: string): WorkflowNode =>
  ({ id, type: 'shell', title: id, position: { x, y }, parentId }) as WorkflowNode;
const frame = (id: string, x: number, y: number): WorkflowNode =>
  ({
    id,
    type: 'custom.frame',
    title: id,
    position: { x, y },
    config: { width: 400, height: 300 },
  }) as WorkflowNode;

function setup(nodes: WorkflowNode[]) {
  const hook = renderHook(() => useEditorCanvas({ lang: 'en' }));
  act(() => hook.result.current.handleLoadWorkflow(nodes, []));
  return hook;
}

const byId = (nodes: WorkflowNode[], id: string) => nodes.find(n => n.id === id)!;

describe('useEditorCanvas React Flow handlers', () => {
  it('drags a frame together with its children and undoes the whole move at once', () => {
    const { result } = setup([frame('f', 0, 0), shell('child', 20, 20, 'f')]);

    act(() => result.current.handleFlowNodeDragStart());
    act(() =>
      result.current.handleFlowNodesChange([
        { type: 'position', id: 'f', position: { x: 100, y: 50 }, dragging: true },
      ] as NodeChange[])
    );
    act(() => result.current.handleFlowNodeDragStop(['f']));

    expect(byId(result.current.nodes, 'child').position).toEqual({ x: 120, y: 70 });

    act(() => result.current.undo());

    expect(byId(result.current.nodes, 'f').position).toEqual({ x: 0, y: 0 });
    expect(byId(result.current.nodes, 'child').position).toEqual({ x: 20, y: 20 });
  });

  it('assigns parentId when a node is dropped inside a frame, and clears it when dragged out', () => {
    const { result } = setup([frame('f', 0, 0), shell('n', 1000, 1000)]);

    const dragTo = (x: number, y: number) => {
      act(() => result.current.handleFlowNodeDragStart());
      act(() =>
        result.current.handleFlowNodesChange([
          { type: 'position', id: 'n', position: { x, y }, dragging: true },
        ] as NodeChange[])
      );
      act(() => result.current.handleFlowNodeDragStop(['n']));
    };

    dragTo(50, 50);
    expect(byId(result.current.nodes, 'n').parentId).toBe('f');

    dragTo(2000, 2000);
    expect(byId(result.current.nodes, 'n').parentId).toBeUndefined();
  });

  it('records one undo entry per resize gesture', () => {
    const { result } = setup([frame('f', 0, 0)]);
    const resize = (width: number, height: number, resizing: boolean) =>
      act(() =>
        result.current.handleFlowNodesChange([
          { type: 'dimensions', id: 'f', dimensions: { width, height }, resizing },
        ] as NodeChange[])
      );

    resize(450, 320, true);
    resize(500, 350, true);
    resize(520, 360, false);

    expect(byId(result.current.nodes, 'f').config).toMatchObject({ width: 520, height: 360 });

    act(() => result.current.undo());

    expect(byId(result.current.nodes, 'f').config).toMatchObject({ width: 400, height: 300 });
    expect(result.current.canUndo).toBe(false);
  });
});

describe('useEditorCanvas undoable inserts', () => {
  const shellType = {
    type: 'shell',
    label: { en: 'Shell', es: 'Shell' },
    icon: null,
    color: '',
    category: 'devops',
  };

  it('undoes a node added from search', () => {
    const { result } = setup([shell('a', 0, 0)]);
    act(() => result.current.handleNodeAddFromSearch(shellType));
    expect(result.current.nodes).toHaveLength(2);
    act(() => result.current.undo());
    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
    act(() => result.current.redo());
    expect(result.current.nodes).toHaveLength(2);
  });

  it('undoes a duplicate of the selection', () => {
    const { result } = setup([shell('a', 0, 0)]);
    act(() => result.current.setSelectedNodes(new Set(['a'])));
    act(() => result.current.handleDuplicateSelected());
    expect(result.current.nodes).toHaveLength(2);
    act(() => result.current.undo());
    expect(result.current.nodes.map(n => n.id)).toEqual(['a']);
  });

  it('undoes an auto-layout in one step', () => {
    const { result } = setup([shell('a', 0, 0)]);
    act(() => result.current.replaceNodes([shell('a', 500, 500)]));
    act(() => result.current.undo());
    expect(byId(result.current.nodes, 'a').position).toEqual({ x: 0, y: 0 });
  });
});
