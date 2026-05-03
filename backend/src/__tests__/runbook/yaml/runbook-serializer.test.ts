import {
  fromSpec,
  RunbookSerializerError,
  specToYaml,
  toSpec,
  WorkflowConnectionRow,
  WorkflowNodeRow,
  WorkflowRow,
  yamlToSpec,
} from '../../../runbook/yaml/runbook-serializer';
import { RunbookSpec } from '../../../runbook/yaml/runbook-spec';

describe('runbook-serializer', () => {
  const runbook: WorkflowRow = {
    id: 'wf-1',
    slug: 'deploy-frontend',
    name: 'Deploy frontend',
    description: 'Build, test, deploy the marketing site',
    category: 'deploy',
    schedule: null,
  };

  const nodes: WorkflowNodeRow[] = [
    {
      id: 'node-build',
      type: 'shell',
      title: 'Build',
      positionX: 100,
      positionY: 200,
      enabled: true,
      config: { command: 'npm run build' },
    },
    {
      id: 'node-approve',
      type: 'approval',
      title: 'Approve deploy',
      positionX: 300,
      positionY: 200,
      enabled: true,
      config: { message: 'Ship it?' },
    },
    {
      id: 'node-deploy',
      type: 'shell',
      title: 'Deploy',
      positionX: 500,
      positionY: 200,
      enabled: true,
      config: { command: 'npm run deploy' },
    },
  ];

  const connections: WorkflowConnectionRow[] = [
    {
      sourceNodeId: 'node-build',
      sourcePort: null,
      targetNodeId: 'node-approve',
      targetPort: null,
    },
    {
      sourceNodeId: 'node-approve',
      sourcePort: null,
      targetNodeId: 'node-deploy',
      targetPort: null,
    },
  ];

  describe('toSpec', () => {
    it('builds a spec with friendly ids and topo-sorted steps', () => {
      const spec = toSpec(runbook, nodes, connections);
      expect(spec.version).toBe(1);
      expect(spec.slug).toBe('deploy-frontend');
      expect(spec.name).toBe('Deploy frontend');
      expect(spec.steps.map(s => s.id)).toEqual(['build', 'approve-deploy', 'deploy']);
    });

    it('collapses single-target next to a string', () => {
      const spec = toSpec(runbook, nodes, connections);
      expect(spec.steps[0].next).toBe('approve-deploy');
      expect(spec.steps[1].next).toBe('deploy');
      expect(spec.steps[2].next).toBeUndefined();
    });

    it('preserves config and position', () => {
      const spec = toSpec(runbook, nodes, connections);
      expect(spec.steps[0].config).toEqual({ command: 'npm run build' });
      expect(spec.steps[0].position).toEqual({ x: 100, y: 200 });
    });

    it('disambiguates duplicate friendly ids', () => {
      const dupNodes: WorkflowNodeRow[] = [
        { ...nodes[0], id: 'a', title: 'Run tests' },
        { ...nodes[0], id: 'b', title: 'Run tests' },
        { ...nodes[0], id: 'c', title: 'Run tests' },
      ];
      const spec = toSpec(runbook, dupNodes, []);
      expect(spec.steps.map(s => s.id)).toEqual(['run-tests', 'run-tests-2', 'run-tests-3']);
    });

    it('emits explicit StepConnection when ports are non-default', () => {
      const portConns: WorkflowConnectionRow[] = [
        {
          sourceNodeId: 'node-build',
          sourcePort: 1,
          targetNodeId: 'node-approve',
          targetPort: null,
        },
      ];
      const spec = toSpec(runbook, nodes.slice(0, 2), portConns);
      expect(spec.steps[0].next).toEqual([{ to: 'approve-deploy', fromPort: 1 }]);
    });

    it('emits an array when a step has multiple successors', () => {
      const fanoutConns: WorkflowConnectionRow[] = [
        {
          sourceNodeId: 'node-build',
          sourcePort: null,
          targetNodeId: 'node-approve',
          targetPort: null,
        },
        {
          sourceNodeId: 'node-build',
          sourcePort: null,
          targetNodeId: 'node-deploy',
          targetPort: null,
        },
      ];
      const spec = toSpec(runbook, nodes, fanoutConns);
      const buildStep = spec.steps.find(s => s.id === 'build')!;
      expect(buildStep.next).toEqual(['approve-deploy', 'deploy']);
    });
  });

  describe('fromSpec', () => {
    it('rejects unsupported version', () => {
      expect(() =>
        fromSpec({ version: 2 as 1, name: 'x', steps: [{ id: 'a', type: 'shell' }] })
      ).toThrow(RunbookSerializerError);
    });

    it('rejects missing name', () => {
      expect(() => fromSpec({ version: 1, name: '', steps: [{ id: 'a', type: 'shell' }] })).toThrow(
        /name/
      );
    });

    it('rejects empty steps', () => {
      expect(() => fromSpec({ version: 1, name: 'x', steps: [] })).toThrow(/at least one step/);
    });

    it('rejects duplicate step ids', () => {
      expect(() =>
        fromSpec({
          version: 1,
          name: 'x',
          steps: [
            { id: 'a', type: 'shell' },
            { id: 'a', type: 'shell' },
          ],
        })
      ).toThrow(/Duplicate/);
    });

    it('rejects unknown next target', () => {
      expect(() =>
        fromSpec({
          version: 1,
          name: 'x',
          steps: [{ id: 'a', type: 'shell', next: 'ghost' }],
        })
      ).toThrow(/unknown step/);
    });

    it('mints UUIDs and resolves friendly references', () => {
      const spec: RunbookSpec = {
        version: 1,
        name: 'x',
        steps: [
          { id: 'a', type: 'shell', next: 'b' },
          { id: 'b', type: 'shell' },
        ],
      };
      const out = fromSpec(spec);
      expect(out.nodes).toHaveLength(2);
      expect(out.connections).toHaveLength(1);
      expect(out.connections[0].sourceNodeId).toBe(out.nodes[0].id);
      expect(out.connections[0].targetNodeId).toBe(out.nodes[1].id);
      // UUIDs, not friendly ids
      expect(out.nodes[0].id).not.toBe('a');
    });

    it('accepts the operari.if branch-label next form', () => {
      // Mirrors the templates/decision-then-approve.yaml shape that
      // previously threw "Invalid `next` value" — the deserializer
      // now maps `true`/`false` to fromPort 0 / 1 respectively.
      const out = fromSpec({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'classify',
            type: 'operari.if',
            next: { true: 'fix', false: 'human' },
          },
          { id: 'fix', type: 'shell' },
          { id: 'human', type: 'approval' },
        ],
      });
      const classifyId = out.nodes.find(n => n.title === 'classify')?.id;
      const fromClassify = out.connections.filter(c => c.sourceNodeId === classifyId);
      expect(fromClassify).toHaveLength(2);
      const ports = fromClassify.map(c => c.sourcePort).sort();
      expect(ports).toEqual([0, 1]);
    });

    it('accepts the approval branch-label next form', () => {
      const out = fromSpec({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'gate',
            type: 'approval',
            next: { approved: 'apply', rejected: 'escalate' },
          },
          { id: 'apply', type: 'shell' },
          { id: 'escalate', type: 'notify' },
        ],
      });
      const gateId = out.nodes.find(n => n.title === 'gate')?.id;
      const ports = out.connections
        .filter(c => c.sourceNodeId === gateId)
        .map(c => c.sourcePort)
        .sort();
      expect(ports).toEqual([0, 1]);
    });

    it('still rejects malformed next values (non-string, non-array, non-object)', () => {
      expect(() =>
        fromSpec({
          version: 1,
          name: 'x',
          steps: [
            {
              id: 'a',
              type: 'shell',
              next: 42 as unknown as string,
            },
          ],
        })
      ).toThrow(/Invalid `next` value/);
    });
  });

  describe('retry policy', () => {
    it('promotes config._retry to top-level retry on toSpec', () => {
      const retryNodes: WorkflowNodeRow[] = [
        {
          ...nodes[0],
          config: {
            command: 'npm run build',
            _retry: { count: 3, backoff: 'exponential', delayMs: 1000, maxDelayMs: 30000 },
          },
        },
      ];
      const spec = toSpec(runbook, retryNodes, []);
      expect(spec.steps[0].retry).toEqual({
        count: 3,
        backoff: 'exponential',
        delayMs: 1000,
        maxDelayMs: 30000,
      });
      expect(spec.steps[0].config).toEqual({ command: 'npm run build' });
    });

    it('omits retry when count is 0 or missing', () => {
      const retryNodes: WorkflowNodeRow[] = [
        { ...nodes[0], config: { command: 'x', _retry: { count: 0 } } },
      ];
      const spec = toSpec(runbook, retryNodes, []);
      expect(spec.steps[0].retry).toBeUndefined();
    });

    it('fromSpec re-injects retry into config._retry', () => {
      const out = fromSpec({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'a',
            type: 'shell',
            config: { command: 'x' },
            retry: { count: 2, backoff: 'fixed', delayMs: 500 },
          },
        ],
      });
      expect(out.nodes[0].config).toEqual({
        command: 'x',
        _retry: { count: 2, backoff: 'fixed', delayMs: 500 },
      });
    });

    it('round-trips a step with a retry policy', () => {
      const retryNodes: WorkflowNodeRow[] = [
        {
          ...nodes[0],
          config: {
            command: 'flaky',
            _retry: { count: 5, backoff: 'exponential', delayMs: 250, maxDelayMs: 10000 },
          },
        },
      ];
      const spec1 = toSpec(runbook, retryNodes, []);
      const text = specToYaml(spec1);
      expect(text).toContain('retry:');
      expect(text).toContain('count: 5');
      const spec2 = yamlToSpec(text);
      expect(spec2).toEqual(spec1);
    });
  });

  describe('conditionals', () => {
    it('promotes config._runIf and _skipIf to top level', () => {
      const condNodes: WorkflowNodeRow[] = [
        {
          ...nodes[0],
          config: {
            command: 'deploy',
            _runIf: '{{vars.env}} == "prod"',
            _skipIf: '{{vars.dryRun}}',
          },
        },
      ];
      const spec = toSpec(runbook, condNodes, []);
      expect(spec.steps[0].runIf).toBe('{{vars.env}} == "prod"');
      expect(spec.steps[0].skipIf).toBe('{{vars.dryRun}}');
      expect(spec.steps[0].config).toEqual({ command: 'deploy' });
    });

    it('ignores empty/whitespace conditional strings', () => {
      const condNodes: WorkflowNodeRow[] = [
        { ...nodes[0], config: { command: 'x', _runIf: '   ', _skipIf: '' } },
      ];
      const spec = toSpec(runbook, condNodes, []);
      expect(spec.steps[0].runIf).toBeUndefined();
      expect(spec.steps[0].skipIf).toBeUndefined();
    });

    it('round-trips conditional fields through yaml', () => {
      const condNodes: WorkflowNodeRow[] = [
        {
          ...nodes[0],
          config: { command: 'flaky', _runIf: '{{vars.canary}}', _skipIf: '{{vars.frozen}}' },
        },
      ];
      const spec1 = toSpec(runbook, condNodes, []);
      const text = specToYaml(spec1);
      expect(text).toContain('runIf:');
      expect(text).toContain('skipIf:');
      const spec2 = yamlToSpec(text);
      expect(spec2).toEqual(spec1);
    });

    it('fromSpec re-injects conditionals into config', () => {
      const out = fromSpec({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'a',
            type: 'shell',
            config: { command: 'x' },
            runIf: '{{vars.go}}',
            skipIf: '{{vars.stop}}',
          },
        ],
      });
      expect(out.nodes[0].config).toEqual({
        command: 'x',
        _runIf: '{{vars.go}}',
        _skipIf: '{{vars.stop}}',
      });
    });
  });

  describe('round-trip', () => {
    it('toSpec → specToYaml → yamlToSpec → toSpec is stable', () => {
      const spec1 = toSpec(runbook, nodes, connections);
      const text = specToYaml(spec1);
      const spec2 = yamlToSpec(text);
      expect(spec2).toEqual(spec1);
    });

    it('YAML output is human-readable', () => {
      const spec = toSpec(runbook, nodes, connections);
      const text = specToYaml(spec);
      expect(text).toContain('version: 1');
      expect(text).toContain('slug: deploy-frontend');
      expect(text).toContain('- id: build');
      expect(text).toContain('next: approve-deploy');
    });
  });
});
