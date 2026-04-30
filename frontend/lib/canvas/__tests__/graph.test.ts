import type { RfNode } from '../adapter';
import { findInnermostFrame, getDescendantIds, sortNodesForRf } from '../graph';

const node = (
  id: string,
  parentId?: string,
  type = 'shell',
  measured?: { width: number; height: number }
): RfNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { workflow: { title: id } },
  ...(parentId ? { parentId } : {}),
  ...(measured ? { measured } : {}),
});

describe('sortNodesForRf', () => {
  it('puts a parent before its child even when input order is reversed', () => {
    const nodes = [node('child', 'parent'), node('parent', undefined, 'custom.frame')];
    const out = sortNodesForRf(nodes);
    expect(out.map(n => n.id)).toEqual(['parent', 'child']);
  });

  it('keeps relative order within the same depth', () => {
    const nodes = [node('a'), node('b'), node('c-1', 'b'), node('c-2', 'b')];
    const out = sortNodesForRf(nodes);
    expect(out.map(n => n.id)).toEqual(['a', 'b', 'c-1', 'c-2']);
  });

  it('handles deeply nested chains', () => {
    const nodes = [
      node('leaf', 'mid'),
      node('mid', 'root'),
      node('root', undefined, 'custom.frame'),
    ];
    const out = sortNodesForRf(nodes);
    expect(out.map(n => n.id)).toEqual(['root', 'mid', 'leaf']);
  });

  it('does not break if parentId references a missing node', () => {
    const nodes = [node('orphan', 'ghost'), node('peer')];
    const out = sortNodesForRf(nodes);
    expect(out.map(n => n.id).sort()).toEqual(['orphan', 'peer']);
  });
});

describe('getDescendantIds', () => {
  it('returns nothing for a leaf', () => {
    const nodes = [node('a')];
    expect(getDescendantIds('a', nodes)).toEqual([]);
  });

  it('walks one level of children', () => {
    const nodes = [
      node('frame', undefined, 'custom.frame'),
      node('a', 'frame'),
      node('b', 'frame'),
    ];
    expect(getDescendantIds('frame', nodes).sort()).toEqual(['a', 'b']);
  });

  it('walks nested descendants', () => {
    const nodes = [
      node('outer', undefined, 'custom.frame'),
      node('inner', 'outer', 'custom.frame'),
      node('leaf', 'inner'),
    ];
    expect(getDescendantIds('outer', nodes).sort()).toEqual(['inner', 'leaf']);
  });
});

describe('findInnermostFrame', () => {
  it('picks the smallest frame by area', () => {
    const dragged = node('d');
    const big = node('big', undefined, 'custom.frame', { width: 400, height: 300 });
    const small = node('small', undefined, 'custom.frame', { width: 200, height: 150 });
    expect(findInnermostFrame(dragged, [big, small])?.id).toBe('small');
  });

  it('returns undefined when there are no candidates with measured dimensions', () => {
    const dragged = node('d');
    const f = node('f', undefined, 'custom.frame');
    expect(findInnermostFrame(dragged, [f])).toBeUndefined();
  });

  it('returns undefined when the candidate list is empty', () => {
    expect(findInnermostFrame(node('d'), [])).toBeUndefined();
  });
});
