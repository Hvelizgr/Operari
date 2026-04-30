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

/** Extract a one-line preview from a node config. */
export const resolvePreview = (
  type: string,
  config: Record<string, unknown> | undefined
): string | null => {
  if (!config) return null;
  const explicit = PRIMARY_PREVIEW_KEY[type];
  if (explicit && typeof config[explicit] === 'string' && (config[explicit] as string).trim()) {
    return config[explicit] as string;
  }
  // Fallback: first non-empty primitive string. Skip meta-keys ("_*").
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith('_')) continue;
    if (typeof value === 'string' && value.trim()) return value;
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
 * Surfaces type-specific operational context: the HTTP verb, the SSH
 * destination, the cron expression. Returns an empty array when the
 * type doesn't have a meaningful secondary signal.
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
      if (host && user) return [`${user}@${host}`];
      if (host) return [host];
      return [];
    }
    case 'operari.cron': {
      const expr = typeof config.expression === 'string' ? config.expression : null;
      return expr ? [expr] : [];
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
