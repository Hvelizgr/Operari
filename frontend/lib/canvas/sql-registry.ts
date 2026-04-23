/**
 * SQL-domain implementation of NodeTypeRegistry.
 *
 * Provides node types for a visual SQL query builder. Each "node"
 * represents a SQL clause or operation. Connecting nodes builds the
 * query pipeline: Source → Filter → Join → Group → Sort → Limit → Output.
 *
 * The canvas is the same EditorCanvas used by runbooks, but with this
 * registry the palette, previews, and validation are SQL-specific.
 */

import {
  ArrowUpDown,
  BarChart3,
  Columns3,
  Combine,
  Eye,
  FileOutput,
  Filter,
  GitMerge,
  Hash,
  Table2,
} from 'lucide-react';
import React from 'react';

import type { BadgeInfo, CategoryPalette, NodeTypeRegistry } from './node-type-registry';
import { defaultRegistryMethods } from './node-type-registry';

// ---- Categories ----

const SQL_CATEGORIES = [
  { id: 'source', label: { en: 'Sources', es: 'Fuentes' }, color: 'text-blue-400' },
  { id: 'transform', label: { en: 'Transform', es: 'Transformar' }, color: 'text-purple-400' },
  { id: 'aggregate', label: { en: 'Aggregate', es: 'Agregar' }, color: 'text-amber-400' },
  { id: 'output', label: { en: 'Output', es: 'Salida' }, color: 'text-emerald-400' },
];

// ---- Node Types ----

const SQL_NODE_TYPES = [
  // === SOURCES ===
  {
    type: 'sql.table',
    icon: React.createElement(Table2, { size: 18 }),
    label: { en: 'Table', es: 'Tabla' },
    color: 'bg-blue-600',
    category: 'source',
    description: { en: 'SELECT FROM a table or view', es: 'SELECT FROM de una tabla o vista' },
    outputs: ['main'],
    properties: [
      { name: 'schema', displayName: 'Schema', type: 'string', default: 'public' },
      { name: 'table', displayName: 'Table name', type: 'string', default: '' },
      {
        name: 'alias',
        displayName: 'Alias',
        type: 'string',
        default: '',
        description: 'Optional table alias (e.g. u for users)',
      },
    ],
  },
  {
    type: 'sql.subquery',
    icon: React.createElement(FileOutput, { size: 18 }),
    label: { en: 'Subquery', es: 'Subconsulta' },
    color: 'bg-blue-500',
    category: 'source',
    description: { en: 'Inline subquery as a source', es: 'Subconsulta inline como fuente' },
    outputs: ['main'],
    properties: [
      { name: 'sql', displayName: 'SQL', type: 'string', default: '', typeOptions: { rows: 5 } },
      { name: 'alias', displayName: 'Alias', type: 'string', default: 'sub' },
    ],
  },

  // === TRANSFORM ===
  {
    type: 'sql.select',
    icon: React.createElement(Columns3, { size: 18 }),
    label: { en: 'Select columns', es: 'Seleccionar columnas' },
    color: 'bg-purple-600',
    category: 'transform',
    description: { en: 'Choose columns to include', es: 'Elegir columnas a incluir' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'columns',
        displayName: 'Columns',
        type: 'string',
        default: '*',
        description: 'Comma-separated column names, or * for all',
      },
      { name: 'distinct', displayName: 'DISTINCT', type: 'boolean', default: false },
    ],
  },
  {
    type: 'sql.filter',
    icon: React.createElement(Filter, { size: 18 }),
    label: { en: 'Filter (WHERE)', es: 'Filtrar (WHERE)' },
    color: 'bg-purple-500',
    category: 'transform',
    description: { en: 'Filter rows with a condition', es: 'Filtrar filas con una condición' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'condition',
        displayName: 'Condition',
        type: 'string',
        default: '',
        typeOptions: { rows: 2 },
        description: "SQL WHERE condition (e.g. age > 18 AND status = 'active')",
      },
    ],
  },
  {
    type: 'sql.join',
    icon: React.createElement(GitMerge, { size: 18 }),
    label: { en: 'Join', es: 'Join' },
    color: 'bg-purple-700',
    category: 'transform',
    description: { en: 'Join with another table', es: 'Join con otra tabla' },
    inputs: ['left', 'right'],
    outputs: ['main'],
    properties: [
      {
        name: 'joinType',
        displayName: 'Join type',
        type: 'options',
        options: [
          { name: 'INNER JOIN', value: 'INNER' },
          { name: 'LEFT JOIN', value: 'LEFT' },
          { name: 'RIGHT JOIN', value: 'RIGHT' },
          { name: 'FULL OUTER JOIN', value: 'FULL' },
          { name: 'CROSS JOIN', value: 'CROSS' },
        ],
        default: 'INNER',
      },
      {
        name: 'on',
        displayName: 'ON condition',
        type: 'string',
        default: '',
        description: 'e.g. users.id = orders.user_id',
      },
    ],
  },
  {
    type: 'sql.sort',
    icon: React.createElement(ArrowUpDown, { size: 18 }),
    label: { en: 'Sort (ORDER BY)', es: 'Ordenar (ORDER BY)' },
    color: 'bg-purple-400',
    category: 'transform',
    description: { en: 'Sort results', es: 'Ordenar resultados' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'columns',
        displayName: 'Columns',
        type: 'string',
        default: '',
        description: 'e.g. created_at DESC, name ASC',
      },
    ],
  },
  {
    type: 'sql.limit',
    icon: React.createElement(Hash, { size: 18 }),
    label: { en: 'Limit', es: 'Límite' },
    color: 'bg-purple-300',
    category: 'transform',
    description: { en: 'Limit rows returned', es: 'Limitar filas devueltas' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { name: 'limit', displayName: 'Limit', type: 'number', default: 100 },
      { name: 'offset', displayName: 'Offset', type: 'number', default: 0 },
    ],
  },
  {
    type: 'sql.union',
    icon: React.createElement(Combine, { size: 18 }),
    label: { en: 'Union', es: 'Unión' },
    color: 'bg-purple-600',
    category: 'transform',
    description: {
      en: 'Combine results from two queries',
      es: 'Combinar resultados de dos consultas',
    },
    inputs: ['top', 'bottom'],
    outputs: ['main'],
    properties: [
      {
        name: 'unionType',
        displayName: 'Type',
        type: 'options',
        options: [
          { name: 'UNION', value: 'UNION' },
          { name: 'UNION ALL', value: 'UNION ALL' },
          { name: 'INTERSECT', value: 'INTERSECT' },
          { name: 'EXCEPT', value: 'EXCEPT' },
        ],
        default: 'UNION ALL',
      },
    ],
  },

  // === AGGREGATE ===
  {
    type: 'sql.group',
    icon: React.createElement(BarChart3, { size: 18 }),
    label: { en: 'Group (GROUP BY)', es: 'Agrupar (GROUP BY)' },
    color: 'bg-amber-600',
    category: 'aggregate',
    description: { en: 'Aggregate with GROUP BY', es: 'Agregar con GROUP BY' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'groupBy',
        displayName: 'Group by',
        type: 'string',
        default: '',
        description: 'Comma-separated columns to group by',
      },
      {
        name: 'aggregations',
        displayName: 'Aggregations',
        type: 'string',
        default: '',
        typeOptions: { rows: 3 },
        description: 'e.g. COUNT(*) AS total, SUM(amount) AS revenue',
      },
      {
        name: 'having',
        displayName: 'HAVING',
        type: 'string',
        default: '',
        description: 'Optional HAVING condition',
      },
    ],
  },

  // === OUTPUT ===
  {
    type: 'sql.output',
    icon: React.createElement(Eye, { size: 18 }),
    label: { en: 'Output', es: 'Salida' },
    color: 'bg-emerald-600',
    category: 'output',
    description: { en: 'Final query output / preview', es: 'Salida final / vista previa' },
    inputs: ['main'],
    properties: [
      { name: 'name', displayName: 'Query name', type: 'string', default: 'query_result' },
      {
        name: 'format',
        displayName: 'Format',
        type: 'options',
        options: [
          { name: 'Table', value: 'table' },
          { name: 'JSON', value: 'json' },
          { name: 'CSV', value: 'csv' },
        ],
        default: 'table',
      },
    ],
  },
];

// ---- Domain functions ----

function configPreview(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') return null;
  const trunc = (s: unknown, n = 55): string => {
    const str = typeof s === 'string' ? s : '';
    if (!str) return '';
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  };
  switch (type) {
    case 'sql.table': {
      const schema = (config.schema as string) || 'public';
      const table = config.table as string;
      const alias = config.alias as string;
      if (!table) return null;
      const full = schema !== 'public' ? `${schema}.${table}` : table;
      return alias ? `${full} AS ${alias}` : full;
    }
    case 'sql.subquery':
      return trunc(config.sql);
    case 'sql.select': {
      const cols = trunc(config.columns ?? '*', 50);
      const dist = config.distinct ? 'DISTINCT ' : '';
      return `${dist}${cols}`;
    }
    case 'sql.filter':
      return config.condition ? `WHERE ${trunc(config.condition, 45)}` : null;
    case 'sql.join': {
      const jt = (config.joinType as string) || 'INNER';
      const on = trunc(config.on, 40);
      return on ? `${jt} ON ${on}` : jt;
    }
    case 'sql.sort':
      return config.columns ? `ORDER BY ${trunc(config.columns, 40)}` : null;
    case 'sql.limit': {
      const lim = config.limit ?? 100;
      const off = config.offset ? ` OFFSET ${config.offset}` : '';
      return `LIMIT ${lim}${off}`;
    }
    case 'sql.union':
      return (config.unionType as string) ?? 'UNION ALL';
    case 'sql.group': {
      const gb = trunc(config.groupBy, 30);
      const agg = trunc(config.aggregations, 25);
      return gb ? `BY ${gb}${agg ? ` · ${agg}` : ''}` : null;
    }
    case 'sql.output':
      return (config.name as string) ?? 'query_result';
    default:
      return null;
  }
}

function validateConfig(
  type: string,
  config: Record<string, unknown> | undefined | null
): string | null {
  if (!config || typeof config !== 'object') return 'No config';
  switch (type) {
    case 'sql.table':
      return config.table ? null : 'Missing table name';
    case 'sql.subquery':
      return config.sql ? null : 'Missing SQL';
    case 'sql.filter':
      return config.condition ? null : 'Missing condition';
    case 'sql.join':
      return config.on ? null : 'Missing ON condition';
    case 'sql.sort':
      return config.columns ? null : 'Missing sort columns';
    case 'sql.group':
      return config.groupBy ? null : 'Missing GROUP BY columns';
    default:
      return null;
  }
}

function categoryPalette(category: string | undefined): CategoryPalette {
  switch (category) {
    case 'source':
      return { accent: '#3b82f6', tint: 'rgba(59, 130, 246, 0.12)' };
    case 'transform':
      return { accent: '#a855f7', tint: 'rgba(168, 85, 247, 0.12)' };
    case 'aggregate':
      return { accent: '#f59e0b', tint: 'rgba(245, 158, 11, 0.12)' };
    case 'output':
      return { accent: '#10b981', tint: 'rgba(16, 185, 129, 0.12)' };
    default:
      return { accent: '#64748b', tint: 'rgba(100, 116, 139, 0.10)' };
  }
}

function previewRenderHint(type: string, config: Record<string, unknown> | undefined | null) {
  if (type !== 'sql.join' || !config) return null;
  const joinType = ((config.joinType as string) || 'INNER').toUpperCase();
  const colors: Record<string, string> = {
    INNER: '#3b82f6',
    LEFT: '#f59e0b',
    RIGHT: '#a855f7',
    FULL: '#ef4444',
    CROSS: '#64748b',
  };
  return {
    type: 'method-chip' as const,
    method: joinType,
    methodColor: colors[joinType] ?? '#64748b',
    url: (config.on as string) ?? '',
  };
}

// ---- Registry instance ----

export const sqlRegistry: NodeTypeRegistry = {
  nodeTypes: SQL_NODE_TYPES as any,
  categories: SQL_CATEGORIES,
  triggerTypes: new Set<string>(),
  organizationTypes: new Set<string>(),
  configPreview,
  validateConfig,
  detectBadges: defaultRegistryMethods.detectBadges,
  categoryPalette,
  previewRenderHint,
};

// ---- SQL Generator ----

export interface SQLNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface SQLConnection {
  source: string;
  target: string;
  sourcePort?: number;
  targetPort?: number;
}

/**
 * Generate a SQL query string from a visual node graph.
 * Walks the DAG from output→sources and assembles the clauses.
 */
export function generateSQL(nodes: SQLNode[], connections: SQLConnection[]): string {
  const outputNode = nodes.find(n => n.type === 'sql.output') ?? nodes[nodes.length - 1];
  if (!outputNode) return '-- Empty query';

  const incomingMap = new Map<string, string[]>();
  for (const conn of connections) {
    const list = incomingMap.get(conn.target) ?? [];
    list.push(conn.source);
    incomingMap.set(conn.target, list);
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  const ordered: SQLNode[] = [];

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const sources = incomingMap.get(nodeId) ?? [];
    for (const src of sources) walk(src);
    const node = nodeMap.get(nodeId);
    if (node) ordered.push(node);
  }
  walk(outputNode.id);

  let selectCols = '*';
  let distinct = false;
  const fromParts: string[] = [];
  const joins: string[] = [];
  const wheres: string[] = [];
  let groupBy = '';
  let aggregations = '';
  let having = '';
  let orderBy = '';
  let limit = '';

  for (const node of ordered) {
    const cfg = node.config ?? {};
    switch (node.type) {
      case 'sql.table': {
        const schema = (cfg.schema as string) || 'public';
        const table = cfg.table as string;
        if (!table) break;
        const full = schema !== 'public' ? `${schema}.${table}` : table;
        const alias = cfg.alias as string;
        fromParts.push(alias ? `${full} AS ${alias}` : full);
        break;
      }
      case 'sql.select':
        selectCols = (cfg.columns as string) || '*';
        distinct = !!cfg.distinct;
        break;
      case 'sql.filter':
        if (cfg.condition) wheres.push(cfg.condition as string);
        break;
      case 'sql.join': {
        const jt = (cfg.joinType as string) || 'INNER';
        const on = cfg.on as string;
        joins.push(`${jt} JOIN /* connected table */ ON ${on || '...'}`);
        break;
      }
      case 'sql.group':
        groupBy = (cfg.groupBy as string) || '';
        aggregations = (cfg.aggregations as string) || '';
        having = (cfg.having as string) || '';
        break;
      case 'sql.sort':
        orderBy = (cfg.columns as string) || '';
        break;
      case 'sql.limit': {
        const l = cfg.limit ?? 100;
        const o = cfg.offset ? ` OFFSET ${cfg.offset}` : '';
        limit = `${l}${o}`;
        break;
      }
      case 'sql.subquery':
        fromParts.push(`(${cfg.sql || '...'}) AS ${cfg.alias || 'sub'}`);
        break;
    }
  }

  const parts: string[] = [];
  const cols = aggregations ? `${groupBy ? groupBy + ', ' : ''}${aggregations}` : selectCols;
  parts.push(`SELECT${distinct ? ' DISTINCT' : ''} ${cols}`);
  if (fromParts.length > 0) parts.push(`FROM ${fromParts.join(', ')}`);
  for (const join of joins) parts.push(join);
  if (wheres.length > 0) parts.push(`WHERE ${wheres.join('\n  AND ')}`);
  if (groupBy) {
    parts.push(`GROUP BY ${groupBy}`);
    if (having) parts.push(`HAVING ${having}`);
  }
  if (orderBy) parts.push(`ORDER BY ${orderBy}`);
  if (limit) parts.push(`LIMIT ${limit}`);

  return parts.join('\n') + ';';
}
