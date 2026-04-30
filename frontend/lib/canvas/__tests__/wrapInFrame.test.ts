import type { RfEdge, RfNode } from '../adapter';
import { wrapInFrame } from '../wrapInFrame';

const node = (id: string, type: string, position = { x: 0, y: 0 }, parentId?: string): RfNode => ({
  id,
  type,
  position,
  data: { workflow: { title: id } },
  measured: { width: 240, height: 120 },
  ...(parentId ? { parentId } : {}),
});

const edge = (id: string, source: string, target: string): RfEdge => ({
  id,
  source,
  target,
  type: 'smart',
  data: {},
});

describe('wrapInFrame', () => {
  it('returns null when nothing is selected', () => {
    expect(wrapInFrame([], [node('a', 'shell')], [])).toBeNull();
  });

  it('wraps siblings into a new frame', () => {
    const nodes = [node('a', 'shell', { x: 100, y: 100 }), node('b', 'shell', { x: 400, y: 100 })];
    const out = wrapInFrame(['a', 'b'], nodes, []);
    expect(out).not.toBeNull();
    const result = out!;
    const frame = result.nodes.find(n => n.id === result.frameId);
    expect(frame).toBeDefined();
    expect(frame!.type).toBe('custom.frame');
    expect(frame!.selected).toBe(true);
    // The frame should be positioned to contain both children with some padding.
    expect(frame!.position.x).toBeLessThan(100);
    expect(frame!.position.y).toBeLessThan(100);

    // Wrapped children get reparented + position rebased to parent-local coords.
    const a = result.nodes.find(n => n.id === 'a')!;
    expect(a.parentId).toBe(result.frameId);
    expect(a.extent).toBe('parent');
    expect(a.position.x).toBeGreaterThan(0);
    expect(a.position.y).toBeGreaterThan(0);
  });

  it('refuses when a selection includes a frame', () => {
    const nodes = [node('frame', 'custom.frame'), node('a', 'shell')];
    expect(wrapInFrame(['frame', 'a'], nodes, [])).toBeNull();
  });

  it('refuses when selected nodes have different parents', () => {
    const nodes = [
      node('a', 'shell', { x: 0, y: 0 }, 'frame-1'),
      node('b', 'shell', { x: 100, y: 0 }, 'frame-2'),
    ];
    expect(wrapInFrame(['a', 'b'], nodes, [])).toBeNull();
  });

  it('preserves edges unchanged', () => {
    const nodes = [node('a', 'shell', { x: 0, y: 0 }), node('b', 'shell', { x: 300, y: 0 })];
    const edges = [edge('e1', 'a', 'b')];
    const out = wrapInFrame(['a', 'b'], nodes, edges);
    expect(out!.edges).toEqual(edges);
  });

  it('produces a frame inside the shared parent when nested', () => {
    const nodes = [
      node('outer', 'custom.frame'),
      node('a', 'shell', { x: 50, y: 50 }, 'outer'),
      node('b', 'shell', { x: 250, y: 50 }, 'outer'),
    ];
    const out = wrapInFrame(['a', 'b'], nodes, []);
    const frame = out!.nodes.find(n => n.id === out!.frameId)!;
    expect(frame.parentId).toBe('outer');
    expect(frame.extent).toBe('parent');
  });

  it('places the new frame in the array before its children (RF requirement)', () => {
    const nodes = [
      node('a', 'shell', { x: 0, y: 0 }),
      node('b', 'shell', { x: 200, y: 0 }),
      node('outsider', 'shell', { x: 800, y: 0 }),
    ];
    const out = wrapInFrame(['a', 'b'], nodes, []);
    const ids = out!.nodes.map(n => n.id);
    const frameIdx = ids.indexOf(out!.frameId);
    expect(frameIdx).toBeLessThan(ids.indexOf('a'));
    expect(frameIdx).toBeLessThan(ids.indexOf('b'));
  });
});
