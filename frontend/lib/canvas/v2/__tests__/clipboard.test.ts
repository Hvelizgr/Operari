import type { RfEdge, RfNode } from '../adapter';
import { buildSnapshot, remapForPaste } from '../clipboard';

const node = (id: string, parentId?: string, type = 'shell'): RfNode => ({
  id,
  type,
  position: { x: 100, y: 100 },
  data: { workflow: { title: id } },
  ...(parentId ? { parentId } : {}),
});

const edge = (id: string, source: string, target: string): RfEdge => ({
  id,
  source,
  target,
  type: 'smart',
  data: {},
});

describe('buildSnapshot', () => {
  it('keeps only edges where both endpoints are selected', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];
    const snap = buildSnapshot(['a', 'b'], nodes, edges);
    expect(snap.nodes.map(n => n.id).sort()).toEqual(['a', 'b']);
    expect(snap.edges.map(e => e.id)).toEqual(['e1']);
  });

  it('pulls descendants when a frame is captured', () => {
    const nodes = [
      node('frame', undefined, 'custom.frame'),
      node('child-1', 'frame'),
      node('child-2', 'frame'),
      node('outsider'),
    ];
    const snap = buildSnapshot(['frame'], nodes, []);
    expect(snap.nodes.map(n => n.id).sort()).toEqual(['child-1', 'child-2', 'frame']);
  });

  it('does not duplicate when a frame and one of its children are both selected', () => {
    const nodes = [node('frame', undefined, 'custom.frame'), node('child', 'frame')];
    const snap = buildSnapshot(['frame', 'child'], nodes, []);
    expect(snap.nodes.map(n => n.id).sort()).toEqual(['child', 'frame']);
  });
});

describe('remapForPaste', () => {
  const original = {
    nodes: [
      node('frame', undefined, 'custom.frame'),
      node('child', 'frame'),
      node('peer'),
    ] as RfNode[],
    edges: [edge('e1', 'child', 'peer')] as RfEdge[],
  };

  it('regenerates every node id and offsets positions', () => {
    const out = remapForPaste(original, { x: 40, y: 40 });
    expect(out.nodes.length).toBe(3);
    const newIds = new Set(out.nodes.map(n => n.id));
    for (const n of original.nodes) expect(newIds.has(n.id)).toBe(false);
    for (const n of out.nodes) {
      expect(n.position.x).toBe(140);
      expect(n.position.y).toBe(140);
      expect(n.selected).toBe(true);
    }
  });

  it('remaps parentId when the parent is in the snapshot', () => {
    const out = remapForPaste(original);
    const frameOut = out.nodes.find(n => n.type === 'custom.frame')!;
    const childOut = out.nodes.find(n => n.id !== frameOut.id && n.parentId !== undefined)!;
    expect(childOut.parentId).toBe(frameOut.id);
  });

  it('drops parentId when the parent was not included in the copy', () => {
    const orphanCopy = {
      nodes: [node('child', 'frame-not-in-copy')] as RfNode[],
      edges: [] as RfEdge[],
    };
    const out = remapForPaste(orphanCopy);
    expect(out.nodes[0].parentId).toBeUndefined();
    expect(out.nodes[0].extent).toBeUndefined();
  });

  it('remaps edge endpoints to the new node ids', () => {
    const out = remapForPaste(original);
    const ids = new Map(original.nodes.map((orig, i) => [orig.id, out.nodes[i].id]));
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].source).toBe(ids.get('child'));
    expect(out.edges[0].target).toBe(ids.get('peer'));
    expect(out.edges[0].id).not.toBe('e1');
  });
});
