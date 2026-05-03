import { captureSnapshot, computeDirtinessMap, fingerprintNode } from '@/lib/canvas/dirtiness';
import type { RfEdge, RfNode } from '@/lib/canvas/adapter';

const node = (id: string, config: Record<string, unknown> = {}): RfNode =>
  ({
    id,
    type: 'shell',
    position: { x: 0, y: 0 },
    data: {
      workflow: { title: id, type: 'shell', config },
    },
  }) as unknown as RfNode;

const edge = (source: string, target: string): RfEdge =>
  ({
    id: `${source}-${target}`,
    source,
    target,
    data: {},
  }) as unknown as RfEdge;

describe('fingerprintNode', () => {
  it('does not mark node dirty for cosmetic-only changes (title, position)', () => {
    const a = node('n1', { command: 'ls' });
    a.position = { x: 100, y: 200 };
    a.data.workflow.title = 'changed-title';
    const b = node('n1', { command: 'ls' });
    expect(fingerprintNode(a, []).config).toBe(fingerprintNode(b, []).config);
  });

  it('marks node dirty when a config key changes', () => {
    const a = node('n1', { command: 'ls' });
    const b = node('n1', { command: 'rm -rf /' });
    expect(fingerprintNode(a, []).config).not.toBe(fingerprintNode(b, []).config);
  });

  it('config fingerprint excludes the pin marker (tracked separately)', () => {
    const a = node('n1', { command: 'ls' });
    const b = node('n1', { command: 'ls', __pinnedOutput: { fake: 'value' } });
    expect(fingerprintNode(a, []).config).toBe(fingerprintNode(b, []).config);
    expect(fingerprintNode(a, []).pin).not.toBe(fingerprintNode(b, []).pin);
  });

  it('incoming hash reflects upstream wiring', () => {
    const target = node('t');
    const beforeEdges = [edge('a', 't')];
    const afterEdges = [edge('a', 't'), edge('b', 't')];
    expect(fingerprintNode(target, beforeEdges).incoming).not.toBe(
      fingerprintNode(target, afterEdges).incoming
    );
  });

  it('incoming hash is stable regardless of edge order', () => {
    const target = node('t');
    const a = [edge('x', 't'), edge('y', 't')];
    const b = [edge('y', 't'), edge('x', 't')];
    expect(fingerprintNode(target, a).incoming).toBe(fingerprintNode(target, b).incoming);
  });
});

describe('computeDirtinessMap', () => {
  it('returns an empty map when no node has been edited since the snapshot', () => {
    const nodes = [node('a', { x: 1 })];
    const snap = captureSnapshot(nodes, []);
    const result = computeDirtinessMap(nodes, [], snap);
    expect(result.size).toBe(0);
  });

  it('returns an empty map when there is no snapshot yet', () => {
    const result = computeDirtinessMap([node('a', { x: 1 })], [], {});
    expect(result.size).toBe(0);
  });

  it('marks parameters-updated when a node config changes after snapshot', () => {
    const before = [node('a', { x: 1 })];
    const snap = captureSnapshot(before, []);
    const after = [node('a', { x: 2 })];
    const result = computeDirtinessMap(after, [], snap);
    expect(result.get('a')).toBe('parameters-updated');
  });

  it('marks incoming-connections-updated when wiring changes', () => {
    const beforeNodes = [node('src'), node('tgt')];
    const beforeEdges = [edge('src', 'tgt')];
    const snap = captureSnapshot(beforeNodes, beforeEdges);
    const afterEdges = [edge('src', 'tgt'), edge('other', 'tgt')];
    const result = computeDirtinessMap([...beforeNodes, node('other')], afterEdges, snap);
    expect(result.get('tgt')).toBe('incoming-connections-updated');
  });

  it('marks pinned-data-updated when a pin is added', () => {
    const before = [node('a')];
    const snap = captureSnapshot(before, []);
    const after = [node('a', { __pinnedOutput: { fake: 1 } })];
    const result = computeDirtinessMap(after, [], snap);
    expect(result.get('a')).toBe('pinned-data-updated');
  });

  it('cascades upstream-dirty to descendants', () => {
    const before = [node('a', { x: 1 }), node('b'), node('c')];
    const beforeEdges = [edge('a', 'b'), edge('b', 'c')];
    const snap = captureSnapshot(before, beforeEdges);
    // Only `a` was directly edited.
    const after = [node('a', { x: 2 }), node('b'), node('c')];
    const result = computeDirtinessMap(after, beforeEdges, snap);
    expect(result.get('a')).toBe('parameters-updated');
    expect(result.get('b')).toBe('upstream-dirty');
    expect(result.get('c')).toBe('upstream-dirty');
  });

  it('a node with its own direct edit keeps its kind, does not get downgraded to upstream-dirty', () => {
    const before = [node('a', { x: 1 }), node('b', { y: 1 })];
    const beforeEdges = [edge('a', 'b')];
    const snap = captureSnapshot(before, beforeEdges);
    const after = [node('a', { x: 2 }), node('b', { y: 2 })];
    const result = computeDirtinessMap(after, beforeEdges, snap);
    expect(result.get('a')).toBe('parameters-updated');
    // b is BOTH directly-edited AND has a dirty upstream — direct
    // edit wins because it's the more specific signal.
    expect(result.get('b')).toBe('parameters-updated');
  });

  it('does not mark a node dirty if it was not in the snapshot (added after the run)', () => {
    const before = [node('a')];
    const snap = captureSnapshot(before, []);
    const after = [node('a'), node('b', { brand: 'new' })];
    const result = computeDirtinessMap(after, [], snap);
    expect(result.has('b')).toBe(false);
  });
});
