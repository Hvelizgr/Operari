import type { Connection, WorkflowNode } from '@operari/shared';

import {
  nodesToSpec,
  RunbookHeader,
  RunbookYamlError,
  specToNodes,
  specToYaml,
  yamlToSpec,
} from '@/utils/runbookYaml';

/**
 * The frontend serializer mirrors backend/src/runbook/yaml/runbook-serializer.
 * Both must produce identical RunbookSpecs for the YAML view to round-trip
 * cleanly between editor and CLI. The backend has its own exhaustive
 * suite — this file covers the in-browser path: shape mapping
 * (WorkflowNode ↔ RunbookStep), retry/conditional metadata extraction,
 * and the full text round-trip.
 */
describe('runbookYaml (frontend)', () => {
  const header: RunbookHeader = {
    name: 'Deploy frontend',
    slug: 'deploy-frontend',
    description: 'Build, approve, deploy',
    category: 'deploy',
    schedule: null,
  };

  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      type: 'shell',
      title: 'Build',
      position: { x: 100, y: 200 },
      config: { command: 'npm run build' },
      enabled: true,
    },
    {
      id: 'n2',
      type: 'approval',
      title: 'Approve deploy',
      position: { x: 300, y: 200 },
      config: { message: 'Ship it?' },
      enabled: true,
    },
    {
      id: 'n3',
      type: 'shell',
      title: 'Deploy',
      position: { x: 500, y: 200 },
      config: { command: 'npm run deploy' },
      enabled: true,
    },
  ];

  const connections: Connection[] = [
    { id: 'c1', source: 'n1', target: 'n2' },
    { id: 'c2', source: 'n2', target: 'n3' },
  ];

  describe('nodesToSpec', () => {
    it('emits a topo-sorted spec with friendly slug ids', () => {
      const spec = nodesToSpec(header, nodes, connections);
      expect(spec.version).toBe(1);
      expect(spec.name).toBe('Deploy frontend');
      expect(spec.slug).toBe('deploy-frontend');
      expect(spec.steps.map(s => s.id)).toEqual(['build', 'approve-deploy', 'deploy']);
    });

    it('collapses single-target connections to a string', () => {
      const spec = nodesToSpec(header, nodes, connections);
      expect(spec.steps[0].next).toBe('approve-deploy');
      expect(spec.steps[2].next).toBeUndefined();
    });

    it('promotes config._retry to top-level retry', () => {
      const retryNodes: WorkflowNode[] = [
        {
          ...nodes[0],
          config: {
            command: 'flaky',
            _retry: { count: 3, backoff: 'exponential', delayMs: 1000, maxDelayMs: 30000 },
          },
        },
      ];
      const spec = nodesToSpec(header, retryNodes, []);
      expect(spec.steps[0].retry).toEqual({
        count: 3,
        backoff: 'exponential',
        delayMs: 1000,
        maxDelayMs: 30000,
      });
      expect(spec.steps[0].config).toEqual({ command: 'flaky' });
    });

    it('promotes runIf and skipIf to top-level fields', () => {
      const condNodes: WorkflowNode[] = [
        {
          ...nodes[0],
          config: {
            command: 'deploy',
            _runIf: '{{vars.env}} == "prod"',
            _skipIf: '{{vars.dryRun}}',
          },
        },
      ];
      const spec = nodesToSpec(header, condNodes, []);
      expect(spec.steps[0].runIf).toBe('{{vars.env}} == "prod"');
      expect(spec.steps[0].skipIf).toBe('{{vars.dryRun}}');
      expect(spec.steps[0].config).toEqual({ command: 'deploy' });
    });
  });

  describe('specToNodes', () => {
    it('rejects empty steps', () => {
      expect(() => specToNodes({ version: 1, name: 'x', steps: [] })).toThrow(RunbookYamlError);
    });

    it('rejects unknown next target', () => {
      expect(() =>
        specToNodes({
          version: 1,
          name: 'x',
          steps: [{ id: 'a', type: 'shell', next: 'ghost' }],
        })
      ).toThrow(/unknown step/);
    });

    it('re-injects retry into config._retry', () => {
      const out = specToNodes({
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

    it('re-injects runIf and skipIf into config', () => {
      const out = specToNodes({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'a',
            type: 'shell',
            runIf: '{{vars.go}}',
            skipIf: '{{vars.stop}}',
          },
        ],
      });
      expect(out.nodes[0].config).toEqual({
        _runIf: '{{vars.go}}',
        _skipIf: '{{vars.stop}}',
      });
    });

    it('accepts the operari.if branch-label form for next', () => {
      const out = specToNodes({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'classify',
            type: 'operari.if',
            next: { true: 'auto_fix', false: 'ask_human' },
          },
          { id: 'auto_fix', type: 'shell' },
          { id: 'ask_human', type: 'approval' },
        ],
      });
      const classifyId = out.nodes.find(n => n.title === 'classify')?.id ?? '';
      const branchEdges = out.connections
        .filter(c => c.source === classifyId)
        .map(c => ({ target: c.target, port: c.sourcePort }));
      // `true` is the first label in operari.if's outputs, so port 0;
      // `false` is port 1.
      expect(branchEdges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ port: 0 }),
          expect.objectContaining({ port: 1 }),
        ])
      );
      expect(branchEdges).toHaveLength(2);
    });

    it('accepts the approval branch-label form for next', () => {
      const out = specToNodes({
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
      const gateId = out.nodes.find(n => n.title === 'gate')?.id ?? '';
      const branchEdges = out.connections.filter(c => c.source === gateId).map(c => c.sourcePort);
      // `approved` → port 0, `rejected` → port 1 per stepCatalog.
      expect(branchEdges.sort()).toEqual([0, 1]);
    });

    it('maps Loop next: { iteration, done } to the right ports', () => {
      const out = specToNodes({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'loop_services',
            type: 'Loop',
            next: { iteration: 'probe', done: 'notify' },
          },
          { id: 'probe', type: 'shell' },
          { id: 'notify', type: 'notify' },
        ],
      });
      const loopId = out.nodes.find(n => n.title === 'loop_services')?.id ?? '';
      const targetByPort = new Map<number, string>();
      for (const c of out.connections.filter(c => c.source === loopId)) {
        targetByPort.set(c.sourcePort ?? 0, c.target);
      }
      const probeId = out.nodes.find(n => n.title === 'probe')?.id ?? '';
      const notifyId = out.nodes.find(n => n.title === 'notify')?.id ?? '';
      // iteration → port 0, done → port 1 per the Loop catalog.
      expect(targetByPort.get(0)).toBe(probeId);
      expect(targetByPort.get(1)).toBe(notifyId);
    });

    it('round-trips a Loop step with iteration + done in labeled form', () => {
      const loopNodes: WorkflowNode[] = [
        {
          id: 'lp',
          type: 'Loop',
          title: 'For each service',
          position: { x: 0, y: 0 },
          config: { itemsPath: 'vars.services' },
          enabled: true,
        },
        {
          id: 'p',
          type: 'shell',
          title: 'probe',
          position: { x: 100, y: 0 },
          config: {},
          enabled: true,
        },
        {
          id: 'n',
          type: 'notify',
          title: 'summary',
          position: { x: 200, y: 0 },
          config: {},
          enabled: true,
        },
      ];
      const loopConns: Connection[] = [
        { id: 'c-iter', source: 'lp', target: 'p', sourcePort: 0 },
        { id: 'c-done', source: 'lp', target: 'n', sourcePort: 1 },
      ];
      const spec = nodesToSpec(header, loopNodes, loopConns);
      // simplifyNext picks the labeled object form when every fromPort
      // maps to a known label without collisions — exactly our case.
      // Friendly ids slugify the title, so look up by name.
      const loopStep = spec.steps.find(s => s.name === 'For each service');
      const probeStep = spec.steps.find(s => s.name === 'probe');
      const notifyStep = spec.steps.find(s => s.name === 'summary');
      expect(loopStep?.next).toEqual({
        iteration: probeStep?.id,
        done: notifyStep?.id,
      });
    });

    it('handles unknown branch labels by assigning ports in insertion order', () => {
      // Custom Switch case the operator added by hand. `case_1` and
      // `default` are known (ports 0 and 2); `case_99` is unknown so
      // it picks up the first unused index past the known set.
      const out = specToNodes({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'router',
            type: 'Switch',
            next: { case_1: 'a', case_99: 'b', default: 'c' },
          },
          { id: 'a', type: 'shell' },
          { id: 'b', type: 'shell' },
          { id: 'c', type: 'shell' },
        ],
      });
      const routerId = out.nodes.find(n => n.title === 'router')?.id ?? '';
      const ports = new Set(
        out.connections.filter(c => c.source === routerId).map(c => c.sourcePort)
      );
      // case_1 = 0, case_99 = 3 (unknown — appended past known length 3),
      // default = 2. Three distinct ports proves no collisions.
      expect(ports.size).toBe(3);
    });

    it('still rejects truly malformed next values', () => {
      expect(() =>
        specToNodes({
          version: 1,
          name: 'x',
          steps: [
            {
              id: 'a',
              type: 'shell',
              // `next: 42` is none of the four accepted shapes.
              next: 42 as unknown as string,
            },
          ],
        })
      ).toThrow(/Invalid `next` value/);
    });
  });

  describe('round-trip', () => {
    it('nodesToSpec → specToYaml → yamlToSpec is stable', () => {
      const spec1 = nodesToSpec(header, nodes, connections);
      const text = specToYaml(spec1);
      const spec2 = yamlToSpec(text);
      expect(spec2).toEqual(spec1);
    });

    it('round-trips a step with retry + conditionals together', () => {
      const fancyNodes: WorkflowNode[] = [
        {
          ...nodes[0],
          config: {
            command: 'deploy',
            _retry: { count: 5, backoff: 'exponential', delayMs: 250, maxDelayMs: 10000 },
            _runIf: '{{vars.canary}}',
            _skipIf: '{{vars.frozen}}',
          },
        },
      ];
      const spec1 = nodesToSpec(header, fancyNodes, []);
      const text = specToYaml(spec1);
      expect(text).toContain('retry:');
      expect(text).toContain('runIf:');
      expect(text).toContain('skipIf:');
      const spec2 = yamlToSpec(text);
      expect(spec2).toEqual(spec1);
    });
  });
});
