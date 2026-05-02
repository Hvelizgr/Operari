/**
 * Canned PostgreSQL queries the SQL editor surfaces from a "Templates"
 * dropdown. Each one is a starter the operator can pick and tweak —
 * we don't try to be a full library, just the queries an SRE actually
 * reaches for during an incident or a routine schema poke.
 *
 * Categories keep the list scannable: `inspect` (read-only system
 * views), `troubleshoot` (lock + slow query stuff), `performance`
 * (index usage, table sizes), `data` (row counts, sample rows).
 */

export type QueryTemplateCategory = 'inspect' | 'troubleshoot' | 'performance' | 'data';

export interface QueryTemplate {
  id: string;
  category: QueryTemplateCategory;
  label: { en: string; es: string };
  description: { en: string; es: string };
  sql: string;
}

export const QUERY_TEMPLATES: QueryTemplate[] = [
  // -----------------------------------------------------------------
  // Inspect (system views)
  // -----------------------------------------------------------------
  {
    id: 'list-tables',
    category: 'inspect',
    label: { en: 'List all tables', es: 'Listar todas las tablas' },
    description: {
      en: 'Every base table grouped by schema, with row count estimates.',
      es: 'Cada tabla base agrupada por schema, con estimaciones de filas.',
    },
    sql: `SELECT
  n.nspname AS schema,
  c.relname AS table,
  c.reltuples::bigint AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY estimated_rows DESC NULLS LAST`,
  },
  {
    id: 'list-views',
    category: 'inspect',
    label: { en: 'List views + matviews', es: 'Listar vistas + matviews' },
    description: {
      en: 'All views and materialized views in the database.',
      es: 'Todas las vistas y materialized views de la DB.',
    },
    sql: `SELECT
  n.nspname AS schema,
  c.relname AS name,
  CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized' END AS kind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema, name`,
  },
  {
    id: 'list-foreign-keys',
    category: 'inspect',
    label: { en: 'List foreign keys', es: 'Listar foreign keys' },
    description: {
      en: 'Every FK in the schema with its referenced target.',
      es: 'Cada FK del schema con su target referenciado.',
    },
    sql: `SELECT
  tc.table_schema || '.' || tc.table_name AS source,
  kcu.column_name AS column,
  ccu.table_schema || '.' || ccu.table_name AS target,
  ccu.column_name AS target_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY source, column`,
  },

  // -----------------------------------------------------------------
  // Troubleshoot
  // -----------------------------------------------------------------
  {
    id: 'active-queries',
    category: 'troubleshoot',
    label: { en: 'Active queries', es: 'Queries activas' },
    description: {
      en: 'Currently running queries longer than 5 seconds. Pair with pg_cancel_backend(pid) to kill.',
      es: 'Queries corriendo ahora hace más de 5s. Combiná con pg_cancel_backend(pid) para matar.',
    },
    sql: `SELECT
  pid,
  now() - query_start AS duration,
  state,
  wait_event,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC`,
  },
  {
    id: 'blocking-locks',
    category: 'troubleshoot',
    label: { en: 'Blocking locks', es: 'Locks bloqueantes' },
    description: {
      en: 'Lists the pid blocking each waiting query — useful when a transaction stalls.',
      es: 'Lista el pid que bloquea cada query en espera — útil cuando una transacción se cuelga.',
    },
    sql: `SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.state != 'idle'`,
  },
  {
    id: 'long-transactions',
    category: 'troubleshoot',
    label: { en: 'Long-running transactions', es: 'Transacciones largas' },
    description: {
      en: 'Open transactions older than 1 minute. These hold locks and bloat the WAL.',
      es: 'Transacciones abiertas hace más de 1 minuto. Mantienen locks y bloatean el WAL.',
    },
    sql: `SELECT
  pid,
  now() - xact_start AS xact_age,
  state,
  query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
  AND now() - xact_start > interval '1 minute'
ORDER BY xact_age DESC`,
  },

  // -----------------------------------------------------------------
  // Performance
  // -----------------------------------------------------------------
  {
    id: 'table-sizes',
    category: 'performance',
    label: { en: 'Table sizes', es: 'Tamaño de tablas' },
    description: {
      en: 'Disk usage per table including indexes + TOAST. Heaviest first.',
      es: 'Espacio en disco por tabla incluyendo índices + TOAST. Más pesadas primero.',
    },
    sql: `SELECT
  n.nspname AS schema,
  c.relname AS table,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20`,
  },
  {
    id: 'unused-indexes',
    category: 'performance',
    label: { en: 'Unused indexes', es: 'Índices sin uso' },
    description: {
      en: 'Indexes with zero scans since stats reset — candidates to drop.',
      es: 'Índices con cero scans desde el último reset de stats — candidatos a borrar.',
    },
    sql: `SELECT
  schemaname AS schema,
  relname AS table,
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  idx_scan AS scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC`,
  },
  {
    id: 'cache-hit-ratio',
    category: 'performance',
    label: { en: 'Cache hit ratio', es: 'Cache hit ratio' },
    description: {
      en: 'Percentage of reads served from shared_buffers. Below 90% = under-provisioned.',
      es: 'Porcentaje de reads servidos desde shared_buffers. Menos de 90% = under-provisioned.',
    },
    sql: `SELECT
  sum(blks_hit) * 100.0 / NULLIF(sum(blks_hit) + sum(blks_read), 0) AS cache_hit_pct
FROM pg_stat_database`,
  },

  // -----------------------------------------------------------------
  // Data
  // -----------------------------------------------------------------
  {
    id: 'row-counts',
    category: 'data',
    label: { en: 'Exact row counts (top 10)', es: 'Conteos exactos (top 10)' },
    description: {
      en: 'WARNING: scans every row of the top 10 largest tables. Slow on big DBs.',
      es: 'OJO: scanea cada fila de las 10 tablas más grandes. Lento en DBs grandes.',
    },
    sql: `-- Replace your_table_name with each table you want to count.
SELECT 'your_table_name' AS table_name, count(*) FROM your_table_name`,
  },
  {
    id: 'sample-rows',
    category: 'data',
    label: { en: 'Sample 10 random rows', es: 'Muestra de 10 filas al azar' },
    description: {
      en: 'TABLESAMPLE BERNOULLI — fast random sample without sorting the whole table.',
      es: 'TABLESAMPLE BERNOULLI — sample rápido sin ordenar toda la tabla.',
    },
    sql: `SELECT * FROM your_table_name TABLESAMPLE BERNOULLI(1) LIMIT 10`,
  },
];

export const QUERY_TEMPLATE_CATEGORIES: Array<{
  id: QueryTemplateCategory;
  label: { en: string; es: string };
}> = [
  { id: 'inspect', label: { en: 'Inspect', es: 'Inspeccionar' } },
  { id: 'troubleshoot', label: { en: 'Troubleshoot', es: 'Diagnosticar' } },
  { id: 'performance', label: { en: 'Performance', es: 'Performance' } },
  { id: 'data', label: { en: 'Data', es: 'Datos' } },
];
