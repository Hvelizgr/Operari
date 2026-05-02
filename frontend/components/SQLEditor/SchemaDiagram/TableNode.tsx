'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight, Eye, Key, Link2, Table2 } from 'lucide-react';
import { memo, useState } from 'react';

import { formatColumnType } from '@/lib/sql/metadata';

import { columnHandleId, type SchemaNode } from './types';

const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 22;

/**
 * Per-column row. Splits PK / FK / nullable into three small badges
 * so the operator can scan the schema without reading every type.
 * Renders both source and target handles for every column — the FK
 * edge picks the right pair via `sourceHandle` / `targetHandle`.
 */
function ColumnRow({
  index,
  name,
  type,
  nullable,
  isPrimaryKey,
  isForeignKey,
  comment,
  diffStatus,
}: {
  index: number;
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  comment: string | null;
  diffStatus?: 'added' | 'removed' | 'changed' | 'unchanged';
}) {
  const top = HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
  // Diff tints reuse the user's status colors via the same CSS vars
  // the editor edges read (`--rb-edge-success/failed/running`). The
  // user's Appearance choices propagate here for free without this
  // component having to consume the visualization context.
  const rowTint =
    diffStatus === 'added'
      ? 'line-through-none bg-[color-mix(in_oklab,var(--rb-edge-success)_15%,transparent)]'
      : diffStatus === 'removed'
        ? 'line-through opacity-70 bg-[color-mix(in_oklab,var(--rb-edge-failed)_15%,transparent)]'
        : diffStatus === 'changed'
          ? 'bg-[color-mix(in_oklab,var(--rb-edge-running)_15%,transparent)]'
          : '';
  return (
    <div
      className={`relative flex items-center gap-1.5 border-t border-zinc-800/60 px-2 text-[11px] ${rowTint}`}
      style={{ height: ROW_HEIGHT }}
      title={comment ?? `${name} ${type}${nullable ? ' (nullable)' : ''}`}
    >
      <span className="flex w-3 shrink-0 items-center justify-center">
        {isPrimaryKey ? (
          <Key size={10} className="text-[color:var(--op-gold)]" />
        ) : isForeignKey ? (
          <Link2 size={10} className="text-sky-400" />
        ) : null}
      </span>
      <span
        className={`min-w-0 flex-1 truncate font-mono ${
          isPrimaryKey ? 'font-semibold text-zinc-100' : 'text-zinc-300'
        }`}
      >
        {name}
        {!nullable && !isPrimaryKey ? (
          <span className="ml-1 text-[9px] text-zinc-500">NOT NULL</span>
        ) : null}
      </span>
      <span className="shrink-0 truncate font-mono text-[10px] text-zinc-500" title={type}>
        {type}
      </span>
      <Handle
        id={columnHandleId(name, 'tgt')}
        type="target"
        position={Position.Left}
        style={{ top, background: '#52525b', width: 6, height: 6 }}
      />
      <Handle
        id={columnHandleId(name, 'src')}
        type="source"
        position={Position.Right}
        style={{ top, background: '#52525b', width: 6, height: 6 }}
      />
    </div>
  );
}

function TableNodeComponent({ data, selected }: NodeProps<SchemaNode>) {
  const { table, diff } = data;
  const [expanded, setExpanded] = useState(true);
  const Icon = table.isView ? Eye : Table2;

  const visibleColumns = expanded ? table.columns : [];

  // Diff state drives a colored ring around the whole table so the
  // operator can scan added/removed/changed at a glance. Per-column
  // dots ride on top inside the ColumnRow.
  const diffStatus = diff?.status;
  const columnDiffByName = new Map(diff?.columns.map(c => [c.name, c.status]) ?? []);

  // Border + ring colors come from the same V2 CSS vars the runbook
  // editor uses, so any Appearance accent / status overrides apply
  // here automatically. `--rb-node-selected` carries the accent
  // color the user picked; the per-status edge vars carry their
  // status overrides.
  const ringClass = selected
    ? 'border-[color:var(--rb-node-selected)] ring-2 ring-[color:var(--rb-node-selected)]/30'
    : diffStatus === 'added'
      ? 'border-[color:var(--rb-edge-success)] ring-1 ring-[color:var(--rb-edge-success)]/30'
      : diffStatus === 'removed'
        ? 'border-[color:var(--rb-edge-failed)] ring-1 ring-[color:var(--rb-edge-failed)]/30'
        : diffStatus === 'changed'
          ? 'border-[color:var(--rb-edge-running)] ring-1 ring-[color:var(--rb-edge-running)]/30'
          : 'border-zinc-700';

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-zinc-950/95 shadow-xl backdrop-blur ${ringClass}`}
      style={{ width: 280, opacity: diffStatus === 'removed' ? 0.6 : 1 }}
      role="group"
      aria-label={`${table.schema}.${table.name}`}
    >
      <div
        className={`flex items-center justify-between gap-2 px-2 ${
          table.isView ? 'bg-indigo-900/40' : 'bg-zinc-800'
        }`}
        style={{ height: HEADER_HEIGHT }}
      >
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-zinc-300 transition-colors hover:text-white"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <Icon
            size={12}
            className={table.isView ? 'text-indigo-300' : 'text-[color:var(--rb-node-selected)]'}
          />
          <span className="truncate text-xs font-semibold text-white">{table.name}</span>
        </button>
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-zinc-500">
          <span title={`schema ${table.schema}`}>{table.schema}</span>
          <span className="rounded bg-black/30 px-1 py-0.5">{table.columns.length}</span>
        </div>
      </div>
      {visibleColumns.map((col, idx) => (
        <ColumnRow
          key={col.name}
          index={idx}
          name={col.name}
          type={formatColumnType(col)}
          nullable={col.nullable}
          isPrimaryKey={table.primaryKeyColumns.has(col.name)}
          isForeignKey={table.foreignKeyColumns.has(col.name)}
          comment={col.comment}
          diffStatus={columnDiffByName.get(col.name)}
        />
      ))}
      {!expanded ? (
        <div
          className="flex items-center justify-center border-t border-zinc-800 px-2 py-1 text-[10px] text-zinc-600"
          style={{ height: ROW_HEIGHT }}
        >
          collapsed · {table.columns.length} columns
        </div>
      ) : null}
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
