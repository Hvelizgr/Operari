import type { Connection, WorkflowNode } from '@nanorun/shared';

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
