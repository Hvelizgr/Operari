/**
 * Pure helpers shared across every editor-node visual variant.
 *
 * Extracted from [../EditorNode.tsx] (was 820 lines) so the variant
 * components — trigger, action, limit, controller, job — don't have
 * to duplicate category coloring, config-preview plucking, or required-
 * field validation. Each function is dumb (no React, no side effects,
 * no DOM), so calling them from a server component, a test, or the
 * Storybook fixture is identical.
 *
 * A future split that finishes componentizing each variant (see the
 * PENDIENTE.md Fase C.3 deferral note) consumes these helpers as-is.
 */

/**
 * Category color palette. Each category gets a left-border accent
 * + an icon background tint so an operator scanning the canvas can
 * tell trigger steps from devops steps from organizational nodes at
 * a glance — without reading any text.
 *
 * The colors are intentionally muted to keep the canvas readable on
 * both light and midnight themes; the brighter accents come from
 * status / running animations layered on top.
 */
export function categoryPalette(category: string | undefined): { accent: string; tint: string } {
  switch (category) {
    case 'devops':
      // Supabase emerald — main brand accent for shell/action nodes
      return { accent: '#3ecf8e', tint: 'rgba(62, 207, 142, 0.14)' };
    case 'triggers':
      // Slightly brighter emerald so triggers pop against devops
      return { accent: '#4ade80', tint: 'rgba(74, 222, 128, 0.14)' };
    case 'core':
      // Sky cyan — flow control (condition, switch, loop). Distinct
      // from emerald so branching steps read as "meta" vs "work".
      return { accent: '#38bdf8', tint: 'rgba(56, 189, 248, 0.14)' };
    case 'organization':
      // Neutral graphite — frames & notes are structural, not actionable
      return { accent: '#71717a', tint: 'rgba(113, 113, 122, 0.12)' };
    default:
      return { accent: '#3ecf8e', tint: 'rgba(62, 207, 142, 0.10)' };
  }
}

/**
 * HTTP method coloring for the smart preview. Mirrors REST client
 * conventions (Postman / Insomnia / Bruno) so a long-time SRE reads
 * the verb instantly.
 */
export function httpMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#10b981'; // emerald
    case 'POST':
      return '#3b82f6'; // blue
    case 'PUT':
      return '#f59e0b'; // amber
    case 'PATCH':
      return '#a855f7'; // purple
    case 'DELETE':
      return '#ef4444'; // red
    default:
      return '#94a3b8';
  }
}

/**
 * Format an execution duration in ms into a tight human string.
 * Used by the duration footer at the bottom of the card.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

/**
 * Per-node-type config preview. Keep this dumb (string-only) so the
 * canvas card can render it without React component composition.
 *
 * The previous render showed every node as "Type: shell, Description:
 * Run a bash command" — same row for every step. Operators couldn't
 * tell two `shell` nodes apart without opening the config panel.
 * This helper plucks the most distinctive field per type and returns
 * a short, truncated summary.
 */
export function configPreview(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') return null;
  const trunc = (s: unknown, n = 60): string => {
    const str = typeof s === 'string' ? s : JSON.stringify(s);
    if (!str) return '';
    if (str.length <= n) return str;
    // Try to break at a word boundary instead of mid-word
    const cut = str.lastIndexOf(' ', n - 1);
    return (cut > n * 0.4 ? str.slice(0, cut) : str.slice(0, n - 1)) + '…';
  };
  switch (type) {
    case 'shell':
      return (config.command as string) ? `$ ${trunc(config.command)}` : null;
    case 'notify': {
      const channel = (config.channel as string) ?? 'webhook';
      const msg = trunc(config.message ?? '', 50);
      return `${channel}${msg ? ` · ${msg}` : ''}`;
    }
    case 'wait': {
      const ms = Number(config.durationMs ?? 0);
      if (!ms) return null;
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
      if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
      return `${(ms / 3_600_000).toFixed(1)}h`;
    }
    case 'approval':
      return (config.message as string) ? trunc(config.message) : null;
    case 'nanorun.httpRequest': {
      const method = ((config.method as string) || 'GET').toUpperCase();
      const url = trunc(config.url ?? '', 50);
      return url ? `${method} ${url}` : method;
    }
    case 'ssh': {
      const host = trunc(config.host ?? '', 30);
      const cmd = trunc(config.command ?? '', 30);
      return host
        ? `${config.username ?? 'root'}@${host}${cmd ? ` · ${cmd}` : ''}`
        : cmd
          ? `$ ${cmd}`
          : null;
    }
    case 'nanorun.database': {
      const op = (config.operation as string) ?? 'health';
      const q = trunc(config.query ?? '', 40);
      const tunnel = config.useSshTunnel ? ' 🔒' : '';
      return op === 'query' && q ? `${op}${tunnel} · ${q}` : `${op}${tunnel}`;
    }
    case 'nanorun.cron':
      return (config.expression as string) ?? null;
    case 'nanorun.webhook':
      return (config.path as string) ? `/${config.path}` : null;
    default:
      return null;
  }
}

/**
 * Per-node-type required-field validation. Returns null if the
 * config is sufficient to attempt running the step, or a short reason
 * string otherwise. Used to paint a visible "incomplete" badge so the
 * operator finds out at edit time, not at run time.
 */
export function validateConfig(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') {
    // The drag-from-palette path now applies defaults, so a node
    // without ANY config is suspicious — but we don't fail here
    // because frame/note legitimately have no config.
    if (type === 'custom.frame' || type === 'custom.note') return null;
    return 'No config';
  }
  switch (type) {
    case 'shell':
      return config.command ? null : 'Missing command';
    case 'notify':
      return config.webhookUrl ? null : 'Missing webhook URL';
    case 'wait':
      return Number(config.durationMs) > 0 ? null : 'Missing duration';
    case 'approval':
      return null; // approver list is optional
    case 'ssh':
      if (!config.host) return 'Missing host';
      if (!config.credentialId) return 'Missing SSH key';
      return config.command ? null : 'Missing command';
    case 'nanorun.database':
      if (!config.credentialId) return 'Missing credential';
      if (config.operation === 'query' && !config.query) return 'Missing SQL query';
      return null;
    case 'nanorun.httpRequest':
      return config.url ? null : 'Missing URL';
    case 'nanorun.cron':
      return config.expression ? null : 'Missing cron expression';
    case 'nanorun.webhook':
      return null; // path defaults at runtime
    default:
      return null;
  }
}

/**
 * Detect cross-cutting metadata stored in the meta-keys (set by the
 * config panel: _retry, _runIf, _skipIf) plus secret references in
 * any config string. Returns the set of badges to render.
 */
export function detectBadges(config: Record<string, unknown> | undefined | null): {
  retry: number | null;
  conditional: 'runIf' | 'skipIf' | 'both' | null;
  secrets: boolean;
} {
  if (!config || typeof config !== 'object') {
    return { retry: null, conditional: null, secrets: false };
  }
  const retryRaw = config._retry as { count?: number } | undefined;
  const retry =
    retryRaw && typeof retryRaw.count === 'number' && retryRaw.count > 0 ? retryRaw.count : null;
  const hasRunIf = !!config._runIf;
  const hasSkipIf = !!config._skipIf;
  const conditional: 'runIf' | 'skipIf' | 'both' | null =
    hasRunIf && hasSkipIf ? 'both' : hasRunIf ? 'runIf' : hasSkipIf ? 'skipIf' : null;
  // Look for {{secrets.X}} in any string field. Cheap regex over
  // the JSON dump — false positives unlikely on a 1KB config blob.
  const secrets = /\{\{\s*secrets\./i.test(JSON.stringify(config));
  return { retry, conditional, secrets };
}
