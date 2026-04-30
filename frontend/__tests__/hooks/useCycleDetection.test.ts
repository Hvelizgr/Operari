import type { RfEdge } from '@/lib/canvas/adapter';

import { findCyclicEdgeIds } from '@/hooks/useCycleDetection';

const edge = (id: string, source: string, target: string): RfEdge => ({
  id,
  source,
  target,
  type: 'smart',
  data: {},
});

describe('findCyclicEdgeIds', () => {
  it('flags a self-loop', () => {
    const result = findCyclicEdgeIds([edge('e1', 'a', 'a')]);
    expect(result.has('e1')).toBe(true);
  });

  it('flags every edge in a 3-cycle', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'a')];
    const result = findCyclicEdgeIds(edges);
    expect([...result].sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('does not flag a DAG', () => {
    const edges = [
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'c'),
      edge('e3', 'a', 'c'),
      edge('e4', 'b', 'd'),
    ];
    const result = findCyclicEdgeIds(edges);
    expect(result.size).toBe(0);
  });

  it('flags only the back-edge in a tree-with-back-edge', () => {
    // a → b → c, plus c → b (the back-edge closes a 2-cycle b↔c)
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('back', 'c', 'b')];
    const result = findCyclicEdgeIds(edges);
    expect(result.has('e2')).toBe(true);
    expect(result.has('back')).toBe(true);
    expect(result.has('e1')).toBe(false);
  });

  it('handles disjoint subgraphs independently', () => {
    const edges = [
      // cycle in component 1
      edge('e1', 'a', 'b'),
      edge('e2', 'b', 'a'),
      // DAG in component 2
      edge('e3', 'x', 'y'),
      edge('e4', 'y', 'z'),
    ];
    const result = findCyclicEdgeIds(edges);
    expect([...result].sort()).toEqual(['e1', 'e2']);
  });
});
