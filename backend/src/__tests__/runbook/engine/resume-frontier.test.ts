import { isReplaySafe } from '../../../runbook/engine/replay-safety';
import { followedConnections, resumeFrontier } from '../../../runbook/engine/resume-frontier';

const n = (id: string, type = 'operari.set', outputs?: unknown[]) => ({ id, type, outputs });
const c = (source: string, target: string, sourcePort?: number) => ({ source, target, sourcePort });

describe('followedConnections', () => {
  it('takes the condition branch the output chose', () => {
    const conns = [c('if', 'yes', 0), c('if', 'no', 1)];
    expect(followedConnections(n('if', 'operari.if'), { conditionResult: true }, conns)).toEqual([
      conns[0],
    ]);
    expect(followedConnections(n('if', 'operari.if'), { conditionResult: false }, conns)).toEqual([
      conns[1],
    ]);
  });

  it('routes an unmatched switch to the last port', () => {
    const sw = n('sw', 'operari.switch', [{}, {}, {}]);
    const conns = [c('sw', 'a', 0), c('sw', 'b', 1), c('sw', 'def', 2)];
    expect(followedConnections(sw, { matchedCase: 1 }, conns)).toEqual([conns[1]]);
    expect(followedConnections(sw, { matchedCase: -1 }, conns)).toEqual([conns[2]]);
  });
});

describe('resumeFrontier', () => {
  const nodes = [
    n('t', 'operari.manualTrigger'),
    n('if', 'operari.if'),
    n('yes'),
    n('no'),
    n('join'),
  ];
  const conns = [c('t', 'if'), c('if', 'yes', 0), c('if', 'no', 1), c('yes', 'join')];
  const start = [nodes[0]];

  it('does not run the branch the condition did not take', () => {
    const r = resumeFrontier({
      nodes,
      connections: conns,
      done: new Set(['t', 'if']),
      outputs: { if: { conditionResult: true } },
      startNodes: start,
    });
    expect('frontier' in r && r.frontier.map(x => x.id)).toEqual(['yes']);
  });

  it('starts over from the trigger when nothing finished before the crash', () => {
    const r = resumeFrontier({
      nodes,
      connections: conns,
      done: new Set(),
      outputs: {},
      startNodes: start,
    });
    expect('frontier' in r && r.frontier.map(x => x.id)).toEqual(['t']);
  });

  it('waits for every parent of a join', () => {
    const join = [n('a'), n('b'), n('j')];
    const r = resumeFrontier({
      nodes: join,
      connections: [c('a', 'j'), c('b', 'j')],
      done: new Set(['a']),
      outputs: {},
      startNodes: [join[0], join[1]],
    });
    expect('frontier' in r && r.frontier.map(x => x.id)).toEqual(['b']);
  });

  it('abandons a run whose loop already started', () => {
    const r = resumeFrontier({
      nodes: [n('t'), n('loop', 'operari.loop'), n('body')],
      connections: [c('t', 'loop'), c('loop', 'body')],
      done: new Set(['t', 'loop']),
      outputs: {},
      startNodes: [n('t')],
    });
    expect(r).toEqual({ abandon: expect.stringMatching(/mid-iteration/) });
  });
});

describe('isReplaySafe', () => {
  it.each([
    [{ type: 'operari.set' }, true],
    [{ type: 'wait' }, true],
    [{ type: 'operari.httpRequest', config: { method: 'get' } }, true],
    [{ type: 'operari.httpRequest', config: {} }, true],
    [{ type: 'operari.httpRequest', config: { method: 'POST' } }, false],
    [{ type: 'operari.database', config: { operation: 'health' } }, true],
    [{ type: 'operari.database', config: { operation: 'query' } }, false],
    [{ type: 'shell' }, false],
    [{ type: 'ssh' }, false],
    [{ type: 'slack' }, false],
    [{ type: 'approval' }, false],
  ])('%j → %s', (node, safe) => expect(isReplaySafe(node)).toBe(safe));
});
