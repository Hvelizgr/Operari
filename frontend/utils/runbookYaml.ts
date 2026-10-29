import type { Connection, WorkflowNode } from '@operari/shared';
import yaml from 'js-yaml';

/**
 * Browser-side runbook YAML serializer.
 *
 * Mirrors backend/src/runbook/yaml/runbook-serializer.ts so the editor
 * can show the YAML view without a server round-trip. Schema is the
 * same canonical RunbookSpec used by the CLI and the v1 API.
 */

export interface RunbookSpec {
  version: 1;
  slug?: string;
  name: string;
  description?: string;
  category?: string;
  schedule?: string;
  vars?: Record<string, unknown>;
  steps: RunbookStep[];
}

export interface RunbookStep {
  id: string;
  type: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  retry?: RetryPolicy;
  runIf?: string;
  skipIf?: string;
  next?: string | string[] | StepConnection[];
  position?: { x: number; y: number };
}

export interface RetryPolicy {
  count: number;
  backoff?: 'fixed' | 'exponential';
  delayMs?: number;
  maxDelayMs?: number;
}

/** Storage convention for cross-cutting per-step metadata. */
export const RETRY_KEY = '_retry';
export const RUN_IF_KEY = '_runIf';
export const SKIP_IF_KEY = '_skipIf';

export interface StepConnection {
  to: string;
  fromPort?: number;
  toPort?: number;
}

export interface RunbookHeader {
  name: string;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  schedule?: string | null;
}

export class RunbookYamlError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'RunbookYamlError';
  }
}

export function nodesToSpec(
  header: RunbookHeader,
  nodes: WorkflowNode[],
  connections: Connection[]
): RunbookSpec {
  const idMap = buildFriendlyIdMap(nodes);

  const steps: RunbookStep[] = nodes.map(node => {
    const friendlyId = idMap.get(node.id)!;
    const outgoing: StepConnection[] = connections
      .filter(c => c.source === node.id)
      .map(c => ({
        to: idMap.get(c.target) ?? c.target,
        fromPort: c.sourcePort,
        toPort: c.targetPort,
      }));

    const step: RunbookStep = {
      id: friendlyId,
      type: node.type,
      name: node.title,
    };
    if (node.enabled === false) step.enabled = false;
    if (node.config && typeof node.config === 'object') {
      const { config, retry, runIf, skipIf } = splitMeta(node.config as Record<string, unknown>);
      if (Object.keys(config).length > 0) step.config = config;
      if (retry) step.retry = retry;
      if (runIf) step.runIf = runIf;
      if (skipIf) step.skipIf = skipIf;
    }
    if (outgoing.length > 0) step.next = simplifyNext(outgoing);
    if (node.position) {
      step.position = { x: node.position.x, y: node.position.y };
    }
    return step;
  });

  const sorted = topoSort(steps);

  const spec: RunbookSpec = { version: 1, name: header.name, steps: sorted };
  if (header.slug) spec.slug = header.slug;
  if (header.description) spec.description = header.description;
  if (header.category) spec.category = header.category;
  if (header.schedule) spec.schedule = header.schedule;
  return spec;
}

export interface ParsedRunbook {
  header: RunbookHeader;
  nodes: WorkflowNode[];
  connections: Connection[];
}

export function specToNodes(spec: RunbookSpec): ParsedRunbook {
  if (spec.version !== 1) {
    throw new RunbookYamlError(`Unsupported version: ${spec.version}`, 'unsupported_version');
  }
  if (!spec.name) throw new RunbookYamlError('name is required', 'missing_name');
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    throw new RunbookYamlError('steps must be a non-empty array', 'no_steps');
  }

  const seen = new Set<string>();
  const idToUuid = new Map<string, string>();
  for (const step of spec.steps) {
    if (!step.id) throw new RunbookYamlError('Each step needs id', 'missing_step_id');
    if (seen.has(step.id)) {
      throw new RunbookYamlError(`Duplicate step id: ${step.id}`, 'duplicate_step_id');
    }
    seen.add(step.id);
    idToUuid.set(step.id, randomId());
  }

  // Default inputs/outputs by node type. Approval has two named outputs
  // (approved/rejected); triggers have no input; everything else is
  // single-in single-out. Matches NodePalette.tsx definitions so the
  // canvas draws the correct poles and the engine routes correctly.
  const defaultPorts = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'approval') {
      return {
        inputs: [{ id: 'in', label: 'Input' }],
        outputs: [
          { id: 'out-0', label: 'approved' },
          { id: 'out-1', label: 'rejected' },
        ],
      };
    }
    if (t.includes('trigger') || t === 'operari.webhook' || t === 'operari.cron') {
      return {
        inputs: [],
        outputs: [{ id: 'out', label: 'Output' }],
      };
    }
    return {
      inputs: [{ id: 'in', label: 'Input' }],
      outputs: [{ id: 'out', label: 'Output' }],
    };
  };

  const nodes: WorkflowNode[] = spec.steps.map((step, index) => {
    const baseConfig = (step.config as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...baseConfig };
    if (step.retry) merged[RETRY_KEY] = step.retry;
    if (step.runIf) merged[RUN_IF_KEY] = step.runIf;
    if (step.skipIf) merged[SKIP_IF_KEY] = step.skipIf;
    const ports = defaultPorts(step.type);
    return {
      id: idToUuid.get(step.id)!,
      type: step.type,
      title: step.name ?? step.id,
      position: {
        x: step.position?.x ?? index * 320,
        y: step.position?.y ?? 0,
      },
      config: merged,
      enabled: step.enabled !== false,
      inputs: ports.inputs,
      outputs: ports.outputs,
    };
  });

  const connections: Connection[] = [];
  for (const step of spec.steps) {
    if (step.next == null) continue;
    for (const conn of expandNext(step.next)) {
      const targetUuid = idToUuid.get(conn.to);
      if (!targetUuid) {
        throw new RunbookYamlError(
          `Step "${step.id}" → unknown step "${conn.to}"`,
          'unknown_target'
        );
      }
      connections.push({
        id: randomId(),
        source: idToUuid.get(step.id)!,
        target: targetUuid,
        sourcePort: conn.fromPort,
        targetPort: conn.toPort,
      });
    }
  }

  return {
    header: {
      name: spec.name,
      slug: spec.slug ?? null,
      description: spec.description ?? null,
      category: spec.category ?? null,
      schedule: spec.schedule ?? null,
    },
    nodes,
    connections,
  };
}

export function specToYaml(spec: RunbookSpec): string {
  return yaml.dump(spec, { indent: 2, lineWidth: 100, noRefs: true, sortKeys: false });
}

export function yamlToSpec(text: string): RunbookSpec {
  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch (err) {
    throw new RunbookYamlError(
      `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
      'invalid_yaml'
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new RunbookYamlError('YAML must be a mapping', 'invalid_root');
  }
  return parsed as RunbookSpec;
}

// ---- helpers ----------------------------------------------------------

function splitMeta(config: Record<string, unknown>): {
  config: Record<string, unknown>;
  retry?: RetryPolicy;
  runIf?: string;
  skipIf?: string;
} {
  const {
    [RETRY_KEY]: rawRetry,
    [RUN_IF_KEY]: rawRunIf,
    [SKIP_IF_KEY]: rawSkipIf,
    ...rest
  } = config;

  let retry: RetryPolicy | undefined;
  if (rawRetry && typeof rawRetry === 'object') {
    const r = rawRetry as Record<string, unknown>;
    const count = typeof r.count === 'number' ? r.count : 0;
    if (count > 0) {
      retry = { count };
      if (r.backoff === 'fixed' || r.backoff === 'exponential') retry.backoff = r.backoff;
      if (typeof r.delayMs === 'number' && r.delayMs >= 0) retry.delayMs = r.delayMs;
      if (typeof r.maxDelayMs === 'number' && r.maxDelayMs >= 0) retry.maxDelayMs = r.maxDelayMs;
    }
  }

  const runIf = typeof rawRunIf === 'string' && rawRunIf.trim() ? rawRunIf : undefined;
  const skipIf = typeof rawSkipIf === 'string' && rawSkipIf.trim() ? rawSkipIf : undefined;

  return { config: rest, retry, runIf, skipIf };
}

function buildFriendlyIdMap(nodes: WorkflowNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const node of nodes) {
    const base = slugify(node.title) || node.type || 'step';
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}-${i++}`;
    used.add(candidate);
    map.set(node.id, candidate);
  }
  return map;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function simplifyNext(connections: StepConnection[]): RunbookStep['next'] {
  const allDefault = connections.every(c => (c.fromPort ?? 0) === 0 && (c.toPort ?? 0) === 0);
  if (allDefault) {
    if (connections.length === 1) return connections[0].to;
    return connections.map(c => c.to);
  }
  return connections;
}

function expandNext(next: NonNullable<RunbookStep['next']>): StepConnection[] {
  if (typeof next === 'string') return [{ to: next }];
  if (Array.isArray(next)) {
    return next.map(item => (typeof item === 'string' ? { to: item } : item));
  }
  throw new RunbookYamlError('Invalid `next` value', 'invalid_next');
}

function topoSort(steps: RunbookStep[]): RunbookStep[] {
  const byId = new Map(steps.map(s => [s.id, s]));
  const indeg = new Map<string, number>(steps.map(s => [s.id, 0]));
  for (const step of steps) {
    if (!step.next) continue;
    for (const conn of expandNext(step.next)) {
      if (byId.has(conn.to)) indeg.set(conn.to, (indeg.get(conn.to) ?? 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of indeg) if (deg === 0) queue.push(id);
  const out: RunbookStep[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const step = byId.get(id);
    if (!step) continue;
    out.push(step);
    if (step.next) {
      for (const conn of expandNext(step.next)) {
        const nextDeg = (indeg.get(conn.to) ?? 0) - 1;
        indeg.set(conn.to, nextDeg);
        if (nextDeg === 0) queue.push(conn.to);
      }
    }
  }
  if (out.length < steps.length) {
    const seen = new Set(out.map(s => s.id));
    for (const s of steps) if (!seen.has(s.id)) out.push(s);
  }
  return out;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID(): string }).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
