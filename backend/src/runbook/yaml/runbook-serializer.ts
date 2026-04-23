import yaml from 'js-yaml';
import { RunbookSpec, RunbookStep, StepConnection, RetryPolicy } from './runbook-spec';

/**
 * Storage convention: per-step retry policy lives on `node.config._retry`
 * because the WorkflowNode model has no dedicated column for it. The
 * serializer pulls it out and surfaces it as the top-level `retry` field
 * in the YAML so authors never see the underscore. fromSpec() puts it
 * back. This keeps schema migrations out of the way for now.
 */
const RETRY_KEY = '_retry';
const RUN_IF_KEY = '_runIf';
const SKIP_IF_KEY = '_skipIf';

/**
 * Serialize / deserialize a runbook between the Prisma storage shape
 * (Workflow + WorkflowNode[] + WorkflowConnection[]) and the canonical
 * RunbookSpec used by the YAML view, the CLI, and Git workflows.
 *
 * Round-trip guarantee: for any spec produced by toSpec(), feeding it
 * back through fromSpec() and toSpec() must yield an identical spec
 * (modulo ordering of steps, which we sort topologically). This is
 * what the YAML editor in the frontend relies on to avoid drift.
 */

export interface WorkflowRow {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  schedule: string | null;
}

export interface WorkflowNodeRow {
  id: string;
  type: string;
  title: string;
  positionX: number;
  positionY: number;
  enabled: boolean;
  config: unknown;
}

export interface WorkflowConnectionRow {
  sourceNodeId: string;
  sourcePort: number | null;
  targetNodeId: string;
  targetPort: number | null;
}

export class RunbookSerializerError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'RunbookSerializerError';
  }
}

/**
 * Build a RunbookSpec from the normalized DB rows.
 *
 * Step ids in the spec are derived from `node.title` (slugified) when
 * unique, falling back to the DB UUID when not. The original UUID is
 * NOT exposed — the YAML uses friendly ids and the editor maintains a
 * separate id↔uuid map. fromSpec() will preserve the friendly id and
 * mint new UUIDs for inserts.
 */
export function toSpec(
  workflow: WorkflowRow,
  nodes: WorkflowNodeRow[],
  connections: WorkflowConnectionRow[],
  vars?: Record<string, unknown>
): RunbookSpec {
  const idMap = buildFriendlyIdMap(nodes);

  const steps: RunbookStep[] = nodes.map(node => {
    const friendlyId = idMap.get(node.id)!;
    const outgoing = connections
      .filter(c => c.sourceNodeId === node.id)
      .map<StepConnection>(c => ({
        to: idMap.get(c.targetNodeId) ?? c.targetNodeId,
        fromPort: c.sourcePort ?? undefined,
        toPort: c.targetPort ?? undefined,
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
    if (outgoing.length > 0) {
      step.next = simplifyNext(outgoing);
    }
    step.position = { x: node.positionX, y: node.positionY };
    return step;
  });

  // Topologically sort so YAML reads top-to-bottom in execution order.
  const sorted = topoSort(steps);

  const spec: RunbookSpec = {
    version: 1,
    name: workflow.name,
    steps: sorted,
  };
  if (workflow.slug) spec.slug = workflow.slug;
  if (workflow.description) spec.description = workflow.description;
  if (workflow.category) spec.category = workflow.category;
  if (workflow.schedule) spec.schedule = workflow.schedule;
  if (vars && Object.keys(vars).length > 0) spec.vars = vars;
  return spec;
}

/**
 * Convert a RunbookSpec back into the rows we will persist.
 *
 * Returns the workflow header fields plus the list of nodes and the
 * list of connections, with newly minted UUIDs. Callers are
 * responsible for diffing against the existing rows in the database
 * (we do not touch Prisma here — keeping the serializer pure makes it
 * trivial to unit-test and reusable from the CLI).
 */
export interface DeserializedRunbook {
  header: {
    slug: string | null;
    name: string;
    description: string | null;
    category: string | null;
    schedule: string | null;
  };
  nodes: Array<{
    id: string;
    friendlyId: string;
    type: string;
    title: string;
    positionX: number;
    positionY: number;
    enabled: boolean;
    config: Record<string, unknown> | null;
  }>;
  connections: Array<{
    sourceNodeId: string;
    sourcePort: number | null;
    targetNodeId: string;
    targetPort: number | null;
  }>;
  vars: Record<string, unknown>;
}

export function fromSpec(spec: RunbookSpec): DeserializedRunbook {
  if (spec.version !== 1) {
    throw new RunbookSerializerError(
      `Unsupported runbook version: ${spec.version}`,
      'unsupported_version'
    );
  }
  if (!spec.name || typeof spec.name !== 'string') {
    throw new RunbookSerializerError('Runbook name is required', 'missing_name');
  }
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    throw new RunbookSerializerError('Runbook must have at least one step', 'no_steps');
  }

  const seen = new Set<string>();
  const friendlyToUuid = new Map<string, string>();

  for (const step of spec.steps) {
    if (!step.id) {
      throw new RunbookSerializerError('Each step must have an id', 'missing_step_id');
    }
    if (seen.has(step.id)) {
      throw new RunbookSerializerError(`Duplicate step id: ${step.id}`, 'duplicate_step_id');
    }
    seen.add(step.id);
    friendlyToUuid.set(step.id, randomUuid());
  }

  const nodes = spec.steps.map((step, index) => {
    const baseConfig = (step.config as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...baseConfig };
    if (step.retry) merged[RETRY_KEY] = step.retry;
    if (step.runIf) merged[RUN_IF_KEY] = step.runIf;
    if (step.skipIf) merged[SKIP_IF_KEY] = step.skipIf;
    return {
      id: friendlyToUuid.get(step.id)!,
      friendlyId: step.id,
      type: step.type,
      title: step.name ?? step.id,
      positionX: step.position?.x ?? index * 200,
      positionY: step.position?.y ?? 0,
      enabled: step.enabled !== false,
      config: Object.keys(merged).length > 0 ? merged : null,
    };
  });

  const connections: DeserializedRunbook['connections'] = [];
  for (const step of spec.steps) {
    if (step.next == null) continue;
    const expanded = expandNext(step.next);
    for (const conn of expanded) {
      const targetUuid = friendlyToUuid.get(conn.to);
      if (!targetUuid) {
        throw new RunbookSerializerError(
          `Step "${step.id}" references unknown step "${conn.to}"`,
          'unknown_target'
        );
      }
      connections.push({
        sourceNodeId: friendlyToUuid.get(step.id)!,
        sourcePort: conn.fromPort ?? null,
        targetNodeId: targetUuid,
        targetPort: conn.toPort ?? null,
      });
    }
  }

  return {
    header: {
      slug: spec.slug ?? null,
      name: spec.name,
      description: spec.description ?? null,
      category: spec.category ?? null,
      schedule: spec.schedule ?? null,
    },
    nodes,
    connections,
    vars: spec.vars ?? {},
  };
}

export function specToYaml(spec: RunbookSpec): string {
  return yaml.dump(spec, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

export function yamlToSpec(text: string): RunbookSpec {
  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch (err) {
    throw new RunbookSerializerError(
      `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
      'invalid_yaml'
    );
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new RunbookSerializerError('YAML must be a mapping', 'invalid_root');
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
    retry = normalizeRetry(rawRetry as Record<string, unknown>);
  }

  const runIf = typeof rawRunIf === 'string' && rawRunIf.trim() ? rawRunIf : undefined;
  const skipIf = typeof rawSkipIf === 'string' && rawSkipIf.trim() ? rawSkipIf : undefined;

  return { config: rest, retry, runIf, skipIf };
}

function normalizeRetry(raw: Record<string, unknown>): RetryPolicy | undefined {
  const count = typeof raw.count === 'number' ? raw.count : undefined;
  if (!count || count <= 0) return undefined;
  const policy: RetryPolicy = { count };
  if (raw.backoff === 'fixed' || raw.backoff === 'exponential') {
    policy.backoff = raw.backoff;
  }
  if (typeof raw.delayMs === 'number' && raw.delayMs >= 0) {
    policy.delayMs = raw.delayMs;
  }
  if (typeof raw.maxDelayMs === 'number' && raw.maxDelayMs >= 0) {
    policy.maxDelayMs = raw.maxDelayMs;
  }
  return policy;
}

function buildFriendlyIdMap(nodes: WorkflowNodeRow[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const node of nodes) {
    let base = slugify(node.title) || node.type || 'step';
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${i++}`;
    }
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
  // If every connection uses default ports, collapse to a string or
  // string[] for readability. Otherwise emit the explicit form.
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
  throw new RunbookSerializerError('Invalid `next` value', 'invalid_next');
}

function topoSort(steps: RunbookStep[]): RunbookStep[] {
  const byId = new Map(steps.map(s => [s.id, s]));
  const indeg = new Map<string, number>(steps.map(s => [s.id, 0]));
  for (const step of steps) {
    if (!step.next) continue;
    for (const conn of expandNext(step.next)) {
      if (byId.has(conn.to)) {
        indeg.set(conn.to, (indeg.get(conn.to) ?? 0) + 1);
      }
    }
  }
  const queue: string[] = [];
  for (const [id, deg] of indeg) {
    if (deg === 0) queue.push(id);
  }
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
  // Cycles or unreachable nodes: append in original order so we
  // never silently drop steps.
  if (out.length < steps.length) {
    const seen = new Set(out.map(s => s.id));
    for (const s of steps) if (!seen.has(s.id)) out.push(s);
  }
  return out;
}

function randomUuid(): string {
  // Lazily import crypto.randomUUID — Node 16+ has this on the
  // crypto module without needing the webcrypto subset.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('crypto').randomUUID();
}
