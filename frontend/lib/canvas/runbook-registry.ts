/**
 * Runbook-domain implementation of NodeTypeRegistry.
 *
 * Contains all the runbook-specific logic that was previously
 * hardcoded in EditorNode.tsx, NodePalette.tsx, and PropertiesPanel.tsx.
 * The canvas components now call this via the registry interface.
 */

import { CATEGORIES, NODE_TYPES } from '@/components/Node/NodePalette';

import type { BadgeInfo, CategoryPalette, NodeTypeRegistry } from './node-type-registry';
import { defaultRegistryMethods } from './node-type-registry';

// ---- Category palette ----

function categoryPalette(category: string | undefined): CategoryPalette {
  switch (category) {
    case 'devops':
      return { accent: '#10b981', tint: 'rgba(16, 185, 129, 0.12)' };
    case 'triggers':
      return { accent: '#22c55e', tint: 'rgba(34, 197, 94, 0.12)' };
    case 'core':
      return { accent: '#3b82f6', tint: 'rgba(59, 130, 246, 0.12)' };
    case 'organization':
      return { accent: '#64748b', tint: 'rgba(100, 116, 139, 0.12)' };
    default:
      return { accent: '#3b82f6', tint: 'rgba(59, 130, 246, 0.10)' };
  }
}

// ---- HTTP method coloring ----

function httpMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return '#10b981';
    case 'POST':
      return '#3b82f6';
    case 'PUT':
      return '#f59e0b';
    case 'PATCH':
      return '#a855f7';
    case 'DELETE':
      return '#ef4444';
    default:
      return '#94a3b8';
  }
}

// ---- Config preview ----

function configPreview(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') return null;
  const trunc = (s: unknown, n = 60): string => {
    const str = typeof s === 'string' ? s : JSON.stringify(s);
    if (!str) return '';
    if (str.length <= n) return str;
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
    case 'Condition': {
      const field = trunc(config.field ?? '', 20);
      const op = (config.operator as string) ?? '?';
      const val = trunc(config.value ?? '', 20);
      return field ? `${field} ${op} ${val}` : null;
    }
    case 'Switch': {
      const sf = trunc(config.field ?? '', 20);
      let caseCount = 0;
      try {
        const parsed = typeof config.cases === 'string' ? JSON.parse(config.cases) : config.cases;
        caseCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        /* ignore */
      }
      return sf ? `${sf} · ${caseCount} cases` : null;
    }
    case 'Loop': {
      const path = trunc(config.itemsPath ?? '', 30);
      return path ? `each ${path}` : null;
    }
    default:
      return null;
  }
}

// ---- Validation ----

function validateConfig(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') {
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
      return null;
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
      return null;
    case 'Condition':
      if (!config.field) return 'Missing field';
      if (!config.operator) return 'Missing operator';
      return null;
    case 'Switch':
      return config.field ? null : 'Missing field';
    case 'Loop':
      if (!config.itemsPath && !config.items) return 'Missing items or items path';
      return null;
    default:
      return null;
  }
}

// ---- Preview render hint (HTTP method chip) ----

function previewRenderHint(
  type: string,
  config: Record<string, unknown> | undefined | null
): {
  type: 'method-chip';
  method: string;
  methodColor: string;
  url: string;
} | null {
  if (type !== 'nanorun.httpRequest' || !config) return null;
  const method = ((config.method as string) || 'GET').toUpperCase();
  const url = typeof config.url === 'string' ? config.url : '';
  return {
    type: 'method-chip',
    method,
    methodColor: httpMethodColor(method),
    url: url.length > 50 ? url.slice(0, 49) + '…' : url,
  };
}

// ---- Registry instance ----

export const runbookRegistry: NodeTypeRegistry = {
  nodeTypes: NODE_TYPES,
  categories: CATEGORIES.map(c => ({
    id: c.id,
    label: c.label,
    color: c.color,
  })),
  triggerTypes: new Set([
    'nanorun.webhook',
    'nanorun.cron',
    'nanorun.scheduleTrigger',
    'nanorun.manualTrigger',
    'Webhook',
    'Trigger',
    'Schedule',
  ]),
  organizationTypes: new Set(['custom.frame', 'custom.note']),
  configPreview,
  validateConfig,
  detectBadges: defaultRegistryMethods.detectBadges,
  categoryPalette,
  previewRenderHint,
};
