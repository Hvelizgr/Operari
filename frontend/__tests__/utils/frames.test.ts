import type { WorkflowNode } from '@operari/shared';

import {
  applyPositionChanges,
  findContainingFrame,
  getDescendantIds,
} from '../../utils/canvas/frames';

const node = (id: string, x: number, y: number, extra: Partial<WorkflowNode> = {}): WorkflowNode =>
  ({ id, type: 'shell', title: id, position: { x, y }, ...extra }) as WorkflowNode;

const frame = (id: string, x: number, y: number, width = 400, height = 300, parentId?: string) =>
  node(id, x, y, { type: 'custom.frame', config: { width, height }, parentId });

describe('getDescendantIds', () => {
  it('collects children of nested frames', () => {
    const nodes = [
      frame('outer', 0, 0, 1000, 1000),
      frame('inner', 50, 50, 500, 500, 'outer'),
      node('a', 100, 100, { parentId: 'inner' }),
      node('b', 600, 600, { parentId: 'outer' }),
      node('loose', 2000, 2000),
    ];

    expect([...getDescendantIds('outer', nodes)].sort()).toEqual(['a', 'b', 'inner']);
  });
});

describe('findContainingFrame', () => {
  it('returns the smallest frame that contains the node center', () => {
    const nodes = [frame('outer', 0, 0, 1000, 1000), frame('inner', 50, 50, 500, 500)];

    expect(findContainingFrame(node('n', 100, 100), nodes)).toBe('inner');
    expect(findContainingFrame(node('n', 700, 700), nodes)).toBe('outer');
    expect(findContainingFrame(node('n', 5000, 5000), nodes)).toBeUndefined();
  });

  it('never assigns a frame to a frame', () => {
    const nodes = [frame('outer', 0, 0, 1000, 1000)];

    expect(findContainingFrame(frame('f', 10, 10), nodes)).toBeUndefined();
  });
});

describe('applyPositionChanges', () => {
  const nodes = [
    frame('f', 0, 0),
    node('child', 20, 20, { parentId: 'f' }),
    node('other', 900, 900),
  ];

  it('moves a dragged frame and carries its children by the same delta', () => {
    const next = applyPositionChanges(nodes, new Map([['f', { x: 100, y: 50 }]]), new Set(['f']));

    expect(next.find(n => n.id === 'f')!.position).toEqual({ x: 100, y: 50 });
    expect(next.find(n => n.id === 'child')!.position).toEqual({ x: 120, y: 70 });
    expect(next.find(n => n.id === 'other')!.position).toEqual({ x: 900, y: 900 });
  });

  it('leaves children put when the frame moves without dragging (resizer edge)', () => {
    const next = applyPositionChanges(nodes, new Map([['f', { x: -40, y: 0 }]]), new Set());

    expect(next.find(n => n.id === 'f')!.position).toEqual({ x: -40, y: 0 });
    expect(next.find(n => n.id === 'child')!.position).toEqual({ x: 20, y: 20 });
  });

  it('does not double-move a child that React Flow already reported', () => {
    const next = applyPositionChanges(
      nodes,
      new Map([
        ['f', { x: 100, y: 0 }],
        ['child', { x: 120, y: 20 }],
      ]),
      new Set(['f', 'child'])
    );

    expect(next.find(n => n.id === 'child')!.position).toEqual({ x: 120, y: 20 });
  });
});
