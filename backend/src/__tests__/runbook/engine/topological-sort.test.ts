import { DagCycleError, topologicalSort } from '../../../runbook/engine/topological-sort';

const node = (id: string) => ({ id });
const edge = (source: string, target: string) => ({ source, target });

describe('topologicalSort', () => {
  it('returns nodes in dependency-satisfied order for a linear chain', () => {
    const order = topologicalSort(
      [node('a'), node('b'), node('c')],
      [edge('a', 'b'), edge('b', 'c')]
    );
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('resolves a diamond so the join comes after both parents', () => {
    //      a
    //     / \
    //    b   c
    //     \ /
    //      d
    const order = topologicalSort(
      [node('a'), node('b'), node('c'), node('d')],
      [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')]
    );
    expect(order[0]).toBe('a');
    expect(order.indexOf('b')).toBeGreaterThan(0);
    expect(order.indexOf('c')).toBeGreaterThan(0);
    expect(order.indexOf('d')).toBe(order.length - 1);
  });

  it('is deterministic across runs for the same input', () => {
    const nodes = [node('c'), node('a'), node('b')];
    const edges = [edge('a', 'b'), edge('a', 'c')];
    const first = topologicalSort(nodes, edges);
    const second = topologicalSort(nodes, edges);
    expect(first).toEqual(second);
    // With sorted tie-break, a comes first; then b and c in lexical order.
    expect(first).toEqual(['a', 'b', 'c']);
  });

  it('throws DagCycleError on a cycle with the pending node ids', () => {
    try {
      topologicalSort(
        [node('a'), node('b'), node('c')],
        [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]
      );
      fail('expected DagCycleError');
    } catch (err) {
      expect(err).toBeInstanceOf(DagCycleError);
      const pending = (err as DagCycleError).pendingNodeIds;
      expect(pending.sort()).toEqual(['a', 'b', 'c']);
    }
  });

  it('ignores self-loops (the node is emitted once, no cycle)', () => {
    const order = topologicalSort([node('a')], [edge('a', 'a')]);
    expect(order).toEqual(['a']);
  });

  it('ignores edges to unknown nodes (handled by separate validation)', () => {
    const order = topologicalSort([node('a'), node('b')], [edge('a', 'b'), edge('b', 'ghost')]);
    expect(order).toEqual(['a', 'b']);
  });

  it('includes disconnected nodes in the output (they have in-degree 0)', () => {
    const order = topologicalSort([node('a'), node('isolated')], []);
    expect(order.sort()).toEqual(['a', 'isolated']);
  });

  it('startNodeIds restricts the sort to the forward reachable subgraph', () => {
    //   a → b → c
    //   x → y
    const order = topologicalSort(
      [node('a'), node('b'), node('c'), node('x'), node('y')],
      [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')],
      { startNodeIds: ['a'] }
    );
    expect(order).toEqual(['a', 'b', 'c']);
    expect(order).not.toContain('x');
    expect(order).not.toContain('y');
  });

  it('startNodeIds with multiple starters unions their reachable subgraphs', () => {
    const order = topologicalSort(
      [node('a'), node('b'), node('c'), node('x'), node('y')],
      [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')],
      { startNodeIds: ['a', 'x'] }
    );
    expect(order.slice().sort()).toEqual(['a', 'b', 'c', 'x', 'y']);
  });

  it('returns empty when startNodeIds are all unknown', () => {
    const order = topologicalSort([node('a')], [], { startNodeIds: ['ghost'] });
    expect(order).toEqual([]);
  });

  it('detects a cycle nested inside a larger DAG', () => {
    //       root
    //      /    \
    //     a      b ← c
    //     |      ↓
    //     ↓      c
    //     …      ↑
    //            └─ b
    expect(() =>
      topologicalSort(
        [node('root'), node('a'), node('b'), node('c')],
        [edge('root', 'a'), edge('root', 'b'), edge('b', 'c'), edge('c', 'b')]
      )
    ).toThrow(DagCycleError);
  });
});
