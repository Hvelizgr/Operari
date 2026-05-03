import type { RfNode } from '@/lib/canvas/adapter';

/**
 * Per-type "primary field" key for the inline config preview line. The
 * preview gives an SRE one extra glance of context — which URL the
 * HTTP step calls, which host the SSH step targets — without opening
 * the inspector. Each entry is the highest-signal key for that type.
 *
 * Plugin / unknown types fall back to picking the first non-empty
 * string in their config (see `resolvePreview`).
 */
export const PRIMARY_PREVIEW_KEY: Record<string, string> = {
  shell: 'command',
  ssh: 'host',
  'operari.httpRequest': 'url',
  'operari.webhook': 'path',
  'operari.cron': 'expression',
  approval: 'message',
  notify: 'channel',
  wait: 'duration',
};

/**
 * Maximum preview length before we ellipsize. Tuned so a typical
 * runbook row doesn't push the canvas card past its 240px min-width.
 * Anything longer (a multi-line shell command, a deep API URL with
 * query params) gets truncated here and the full value still lives
 * in the node's `title` attribute via the BaseStepNode hover tooltip
 * + the inspector panel — so the operator never loses access, just
 * the hot-path scanning stays compact.
 */
const PREVIEW_MAX_LEN = 60;

/**
 * Pick the first line of a possibly-multi-line string + trim, then
 * cap at `PREVIEW_MAX_LEN`. Multi-line shell commands previously
 * pushed the node taller; by collapsing to the first line we keep
 * the card on a single body row regardless of script complexity.
 */
const compactPreview = (raw: string): string => {
  const firstLine = raw.split('\n', 1)[0]?.trim() ?? raw;
  return firstLine.length > PREVIEW_MAX_LEN
    ? `${firstLine.slice(0, PREVIEW_MAX_LEN - 1)}…`
    : firstLine;
};

/**
 * Field-name chips shown on the collapsed card body. The intent is
 * "show the operator WHICH properties the node accepts and which are
 * already configured, without leaking the values" — none of the
 * leading editors do this (they all leak at least one value), but
 * it's the per-glance teaching aid Operari runs aim for.
 *
 * Keys are the most operator-relevant fields per type. Order in the
 * array drives chip render order. A chip renders FILLED when the
 * config has a non-empty / non-default value for that key, OUTLINED
 * otherwise — so the operator sees which fields are still default.
 */
export const PRIMARY_FIELDS: Record<string, string[]> = {
  shell: ['command', 'shell', 'timeout'],
  ssh: ['host', 'username', 'command'],
  'operari.httpRequest': ['method', 'url', 'body'],
  'operari.database': ['operation', 'credentialId', 'query'],
  'operari.postgres': ['operation', 'credentialId', 'query'],
  'operari.cron': ['expression'],
  'operari.if': ['field', 'operator', 'value'],
  Condition: ['field', 'operator', 'value'],
  Switch: ['field', 'cases'],
  Loop: ['itemsPath', 'items'],
  'operari.loop': ['itemsPath', 'items'],
  approval: ['message', 'approvers'],
  notify: ['channel', 'webhookUrl', 'message'],
  wait: ['durationMs'],
  kubectl: ['command', 'namespace', 'kubeconfigSecret'],
  Email: ['to', 'subject', 'body'],
  StoreGet: ['bucketName', 'key'],
  StoreSet: ['bucketName', 'key', 'value'],
  Transform: ['mapping'],
  runbook: ['runbookId', 'inputs', 'waitFor'],
  'github.commitFile': ['repo', 'branch', 'path'],
};

/**
 * True when the operator has set a non-default / non-empty value on
 * `field` of `config`. Used by the field-name chip strip on
 * BaseStepNode to render the chip filled vs outlined. Treats empty
 * strings, null/undefined, empty arrays, and the literal string
 * `"{}"` (default for JSON-shaped fields) as "not configured".
 */
export const isFieldConfigured = (
  config: Record<string, unknown> | undefined,
  field: string
): boolean => {
  if (!config) return false;
  const v = config[field];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0 && v.trim() !== '{}' && v.trim() !== '[]';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'boolean') return v;
  return false;
};

/** Extract a one-line preview from a node config. */
export const resolvePreview = (
  type: string,
  config: Record<string, unknown> | undefined
): string | null => {
  if (!config) return null;
  const explicit = PRIMARY_PREVIEW_KEY[type];
  if (explicit && typeof config[explicit] === 'string' && (config[explicit] as string).trim()) {
    return compactPreview(config[explicit] as string);
  }
  // Fallback: first non-empty primitive string. Skip meta-keys ("_*").
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith('_')) continue;
    if (typeof value === 'string' && value.trim()) return compactPreview(value);
  }
  return null;
};

/**
 * Tags live in `config._tags` (string array). The underscore prefix
 * keeps `splitMeta` from copying them into the YAML step body — they
 * survive as opaque config metadata, same pattern as `_frame.parentId`
 * and `_retry`.
 */
export const resolveTags = (config: Record<string, unknown> | undefined): string[] => {
  if (!config) return [];
  const raw = config._tags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string' && t.length > 0);
};

/**
 * Secondary chip(s) shown next to the node-type label in the header.
 * Surfaces type-specific operational context — the operation verb,
 * the destination, the count — at-a-glance without expanding the
 * card. The intent is "what does this node DO" not "what value does
 * it use", so chips lean on operations / counts / shapes rather
 * than full values; long values get truncated.
 */
export const resolveSecondaryChips = (
  type: string,
  config: Record<string, unknown> | undefined
): string[] => {
  if (!config) return [];
  switch (type) {
    case 'operari.httpRequest': {
      const method = typeof config.method === 'string' ? config.method : null;
      return method ? [method] : [];
    }
    case 'ssh': {
      const host = typeof config.host === 'string' ? config.host : null;
      const user = typeof config.username === 'string' ? config.username : null;
      // Long internal hostnames (e.g. `internal-k8s-prod-us-east-1.
      // company.internal`) push the chip past the card width. Keep
      // the user@host shape intact but cap the host portion at 24
      // chars so the chip stays inside the header band.
      const compactHost = host && host.length > 24 ? `${host.slice(0, 23)}…` : host;
      if (compactHost && user) return [`${user}@${compactHost}`];
      if (compactHost) return [compactHost];
      return [];
    }
    case 'operari.cron': {
      const expr = typeof config.expression === 'string' ? config.expression : null;
      return expr ? [expr] : [];
    }
    case 'operari.if':
    case 'Condition': {
      // Condition uses `field operator value` shape. We surface the
      // operator alone — the field path and value are too noisy for
      // a chip and live on the inspector form anyway.
      const op = typeof config.operator === 'string' ? config.operator : null;
      // Map raw operator strings to compact glyphs / words. The
      // glyphs match what an SRE writes in a postmortem.
      const OP_MAP: Record<string, string> = {
        equals: '==',
        notEquals: '≠',
        contains: 'contains',
        greaterThan: '>',
        lessThan: '<',
        isEmpty: 'isEmpty',
        isNotEmpty: 'isNotEmpty',
      };
      return op ? [OP_MAP[op] ?? op] : [];
    }
    case 'Switch': {
      // `cases` is stored as a JSON array in the form (a string in
      // the textarea, parsed at run time). Count its entries to show
      // "3 cases" instead of leaking the case values.
      const raw = config.cases;
      if (Array.isArray(raw)) return raw.length > 0 ? [`${raw.length} cases`] : [];
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.length > 0 ? [`${parsed.length} cases`] : [];
        } catch {
          /* malformed JSON — fall through to no chip */
        }
      }
      return [];
    }
    case 'Loop':
    case 'operari.loop': {
      // Loop reads either an inline `items` array or a path on input
      // via `itemsPath`. We surface which mode is active so the
      // operator can tell at-a-glance whether the iteration is
      // hard-coded or pulled from the previous step.
      if (typeof config.itemsPath === 'string' && config.itemsPath.trim()) {
        return ['from input'];
      }
      if (Array.isArray(config.items)) {
        return config.items.length > 0 ? [`${config.items.length} items`] : [];
      }
      return [];
    }
    case 'notify': {
      const channel = typeof config.channel === 'string' ? config.channel : null;
      return channel ? [channel] : [];
    }
    case 'wait': {
      // Duration in ms, formatted compact. The wait executor reads
      // `durationMs` so we mirror that key exactly.
      const ms = typeof config.durationMs === 'number' ? config.durationMs : null;
      if (ms == null || ms <= 0) return [];
      if (ms < 1000) return [`${ms}ms`];
      if (ms < 60_000) return [`${Math.round(ms / 100) / 10}s`];
      if (ms < 3_600_000) return [`${Math.round(ms / 60_000)}m`];
      return [`${Math.round(ms / 3_600_000)}h`];
    }
    case 'kubectl': {
      // `command` is "get pods" / "apply -f -" / "delete pod foo" — we
      // pull the first whitespace-delimited token (the verb) so the
      // chip reads as `get` / `apply` / `delete`. Easier to scan than
      // the full command which already lives in the preview line.
      const cmd = typeof config.command === 'string' ? config.command.trim() : '';
      if (!cmd) return [];
      const verb = cmd.split(/\s+/, 1)[0];
      return verb ? [verb] : [];
    }
    case 'operari.database':
    case 'operari.postgres': {
      const op = typeof config.operation === 'string' ? config.operation : null;
      return op ? [op] : [];
    }
    default:
      return [];
  }
};

/**
 * Infer a semantic tone from an output handle label so we can color
 * the handle dot by what condition it represents. Cheap heuristic on
 * the label string — the catalog uses conventional names ('ok',
 * 'err', 'main', 'warning') so a substring check covers everything
 * we ship and degrades gracefully for plugin-defined types.
 *
 * Returns a CSS color (an `--op-*` var) or null for the neutral
 * default. The caller stamps it onto the `<Handle>` style.
 */
export const handleTone = (label: string): string | null => {
  const l = label.toLowerCase();
  if (l === 'err' || l === 'error' || l === 'fail' || l === 'failure') return 'var(--op-sunset)';
  if (l === 'ok' || l === 'success' || l === 'done') return 'var(--op-moss)';
  if (l === 'warn' || l === 'warning') return 'var(--op-gold)';
  if (l === 'skip' || l === 'skipped') return 'var(--op-fog)';
  return null;
};

/**
 * `outputCount` here is "how many handles the type *should* have on the
 * source side" (looked up in the catalog by the caller). Compared
 * against the live edge count we get from `useNodeConnections`, this
 * lets us flag a step whose outputs are entirely dangling — an
 * authoring smell that produces a runbook with unreachable terminal
 * states.
 */
export const isOrphanOutput = (
  type: string,
  expectedOutputs: number,
  liveOutgoing: number,
  status: NonNullable<RfNode['data']['status']> | undefined
): boolean => {
  // Only flag step-type nodes that were authored to produce an output
  // but currently have none wired. Frames and notes don't apply.
  if (type === 'custom.frame' || type === 'custom.note') return false;
  if (expectedOutputs === 0) return false;
  // While running we don't want a transient red badge.
  if (status === 'running') return false;
  return liveOutgoing === 0;
};
