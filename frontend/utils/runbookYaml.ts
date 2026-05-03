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
  /**
   * Outgoing edges. Four shapes are accepted:
   *   - `string` — single edge to that step (default port).
   *   - `string[]` — multiple edges, all on default port.
   *   - `StepConnection[]` — explicit `to` + ports, for non-default routing.
   *   - `Record<string, string | StepConnection>` — branch-label form
   *     used by multi-output steps (`operari.if`, `approval`, `Switch`).
   *     Each key is the output port label; the value is the target id.
   *     The parser maps labels to port indices via `BRANCH_OUTPUTS`.
   */
  next?: string | string[] | StepConnection[] | Record<string, string | StepConnection>;
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
    // Pass `step` so `simplifyNext` can emit the labeled object form
    // (`next: { prod: foo, staging: bar }`) for multi-output step
    // types instead of the index-based array (`next: [{to: foo,
    // fromPort: 0}, ...]`). Preserves the YAML the operator wrote.
    if (outgoing.length > 0) step.next = simplifyNext(outgoing, step);
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

  const nodes: WorkflowNode[] = spec.steps.map((step, index) => {
    const baseConfig = (step.config as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...baseConfig };
    if (step.retry) merged[RETRY_KEY] = step.retry;
    if (step.runIf) merged[RUN_IF_KEY] = step.runIf;
    if (step.skipIf) merged[SKIP_IF_KEY] = step.skipIf;
    return {
      id: idToUuid.get(step.id)!,
      type: step.type,
      title: step.name ?? step.id,
      position: {
        x: step.position?.x ?? index * 200,
        y: step.position?.y ?? 0,
      },
      config: merged,
      enabled: step.enabled !== false,
    };
  });

  const connections: Connection[] = [];
  for (const step of spec.steps) {
    if (step.next == null) continue;
    for (const conn of expandNext(step.next, step)) {
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
    // Pinned output is editor-author state, not part of the canonical
    // runbook YAML — strip it so YAML round-trips stay clean.
    __pinnedOutput: _pin,
    ...rest
  } = config;
  void _pin;

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

function simplifyNext(
  connections: StepConnection[],
  sourceStep?: { type?: string; config?: unknown }
): RunbookStep['next'] {
  const allDefault = connections.every(c => (c.fromPort ?? 0) === 0 && (c.toPort ?? 0) === 0);
  if (allDefault) {
    if (connections.length === 1) return connections[0].to;
    return connections.map(c => c.to);
  }
  // Multi-output step types — try the labeled object form so the
  // YAML stays human-readable (`next: { approved: foo, rejected:
  // bar }`) instead of the index-based array. Only kicks in when
  // every connection's fromPort maps to a known label AND no two
  // connections share the same label.
  if (sourceStep) {
    const labels = resolvePortLabels(sourceStep);
    if (labels.length > 0) {
      const usedLabels = new Set<string>();
      const labeled: Record<string, string | StepConnection> = {};
      let allLabelable = true;
      for (const conn of connections) {
        const port = conn.fromPort ?? 0;
        const label = labels[port];
        if (label == null || usedLabels.has(label) || (conn.toPort ?? 0) !== 0) {
          allLabelable = false;
          break;
        }
        usedLabels.add(label);
        // Bare string when only `to` differs — matches the form
        // operators write by hand.
        labeled[label] = conn.to;
      }
      if (allLabelable) return labeled;
    }
  }
  return connections;
}

/**
 * Resolve the source step's port labels. For most step types the
 * answer is the static catalog list; for `Switch` the labels come
 * from the step's own `config.cases` (each operator-defined case
 * gets its own port, plus an implicit `default` at the end).
 * Returns an empty array when the step has no multi-output config —
 * callers fall back to insertion order in that case.
 *
 * Mirrors `lib/canvas/portLabels.ts` but kept inline so the YAML
 * parser doesn't have to import a UI module.
 */
const STATIC_BRANCH_OUTPUTS: Record<string, string[]> = {
  approval: ['approved', 'rejected'],
  'operari.if': ['true', 'false'],
  Condition: ['true', 'false'],
  Loop: ['iteration', 'done'],
  Iterator: ['iteration', 'done'],
  'operari.loop': ['iteration', 'done'],
};

function deriveSwitchOutputsFromConfig(config: unknown): string[] {
  let cases: Array<{ label?: string; value?: string }> = [];
  if (config && typeof config === 'object') {
    const raw = (config as { cases?: unknown }).cases;
    if (Array.isArray(raw)) {
      cases = raw as Array<{ label?: string; value?: string }>;
    } else if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cases = parsed;
      } catch {
        /* mid-edit string — fall through */
      }
    }
  }
  const labels = cases
    .map(c => (c && typeof c === 'object' ? (c.label ?? c.value ?? null) : null))
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
  return [...labels, 'default'];
}

function resolvePortLabels(step: { type?: string; config?: unknown }): string[] {
  const type = step.type;
  if (!type) return [];
  if (type === 'Switch') return deriveSwitchOutputsFromConfig(step.config);
  return STATIC_BRANCH_OUTPUTS[type] ?? [];
}

function expandNext(
  next: NonNullable<RunbookStep['next']>,
  step?: { type?: string; config?: unknown }
): StepConnection[] {
  if (typeof next === 'string') return [{ to: next }];
  if (Array.isArray(next)) {
    return next.map(item => (typeof item === 'string' ? { to: item } : item));
  }
  if (next && typeof next === 'object') {
    // Object-keyed branch form: `{ approved: 'fix', rejected: 'escalate' }`
    // or `{ prod: deploy_prod, staging: deploy_staging }` for Switch.
    // Maps each key to a fromPort index using the step's resolved
    // labels (static for approval/operari.if/Condition, dynamic for
    // Switch via config.cases). Unknown keys get a stable port
    // assigned by insertion order so round-trips don't reshuffle.
    const known: string[] = step ? resolvePortLabels(step) : [];
    const entries = Object.entries(next as Record<string, string | StepConnection>);
    const ports = new Map<string, number>();
    known.forEach((label, idx) => ports.set(label, idx));
    let nextPort = known.length;
    return entries.map(([label, value]) => {
      let port = ports.get(label);
      if (port == null) {
        port = nextPort++;
        ports.set(label, port);
      }
      const base = typeof value === 'string' ? { to: value } : value;
      return { ...base, fromPort: base.fromPort ?? port };
    });
  }
  throw new RunbookYamlError('Invalid `next` value', 'invalid_next');
}

function topoSort(steps: RunbookStep[]): RunbookStep[] {
  const byId = new Map(steps.map(s => [s.id, s]));
  const indeg = new Map<string, number>(steps.map(s => [s.id, 0]));
  for (const step of steps) {
    if (!step.next) continue;
    for (const conn of expandNext(step.next, step)) {
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
      for (const conn of expandNext(step.next, step)) {
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
