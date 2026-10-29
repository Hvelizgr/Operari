import type { Connection, WorkflowNode } from '@operari/shared';

import { normalizeLegacyNodes } from '../../utils/canvas/legacy';

const LEGACY_DEMO = [
  {
    id: 'demo-note',
    type: 'note',
    position: { x: 160, y: 120 },
    data: { text: 'Welcome to Operari.' },
  },
  {
    id: 'demo-shell',
    type: 'shell',
    position: { x: 160, y: 340 },
    data: { label: 'Print greeting', command: 'echo "hello from Operari"' },
  },
];
const LEGACY_CONNECTIONS: Connection[] = [
  { id: 'demo-connection', source: 'demo-note', target: 'demo-shell' },
];

describe('normalizeLegacyNodes', () => {
  it('converts the pre-fix demo runbook into canvas nodes', () => {
    const { nodes, connections } = normalizeLegacyNodes(LEGACY_DEMO, LEGACY_CONNECTIONS);

    expect(nodes).toEqual([
      {
        id: 'demo-note',
        type: 'custom.note',
        title: 'Note',
        position: { x: 160, y: 120 },
        config: { text: 'Welcome to Operari.' },
      },
      {
        id: 'demo-shell',
        type: 'shell',
        title: 'Print greeting',
        position: { x: 160, y: 340 },
        enabled: true,
        config: { command: 'echo "hello from Operari"' },
        inputs: [{ id: 'in', label: 'Input' }],
        outputs: [{ id: 'out', label: 'Output' }],
      },
    ]);
    expect(connections).toEqual([]);
  });

  it('returns current-shape runbooks untouched', () => {
    const current = [
      { id: 'a', type: 'shell', title: 'A', position: { x: 0, y: 0 }, config: {} },
    ] as WorkflowNode[];
    const conns: Connection[] = [{ id: 'c', source: 'a', target: 'b' }];

    const result = normalizeLegacyNodes(current, conns);

    expect(result.nodes).toBe(current);
    expect(result.connections).toBe(conns);
  });

  it('falls back to the step type when a legacy step has no label', () => {
    const { nodes } = normalizeLegacyNodes(
      [{ id: 'x', type: 'shell', position: { x: 0, y: 0 }, data: { command: 'ls' } }],
      []
    );

    expect(nodes[0].title).toBe('shell');
  });
});
