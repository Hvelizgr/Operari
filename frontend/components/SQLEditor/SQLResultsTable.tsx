'use client';

import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export interface SQLResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
  fields: { name: string; dataTypeID: number }[];
  durationMs: number;
}

export interface SQLError {
  error: string;
  durationMs?: number;
}

interface SQLResultsTableProps {
  result: SQLResult | null;
  error: SQLError | null;
  isLoading: boolean;
  lang: 'en' | 'es';
}

export default function SQLResultsTable({ result, error, isLoading, lang }: SQLResultsTableProps) {
  const t =
    lang === 'es'
      ? {
          noResults: 'Ejecuta una query para ver resultados',
          rows: 'filas',
          running: 'Ejecutando...',
          error: 'Error',
        }
      : {
          noResults: 'Run a query to see results',
          rows: 'rows',
          running: 'Running...',
          error: 'Error',
        };

  // Format cell values for display
  const formatCell = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400" />
        {t.running}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 text-sm">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
        <div>
          <div className="font-medium text-red-300">{t.error}</div>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-red-400/80">
            {error.error}
          </pre>
          {error.durationMs != null && (
            <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
              <Clock size={10} />
              {error.durationMs}ms
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
        {t.noResults}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-400" />
          {result.rowCount ?? result.rows.length} {t.rows}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {result.durationMs}ms
        </span>
        <span className="text-zinc-600">{result.fields.length} columns</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10 border-b border-zinc-700 bg-zinc-900/95 px-3 py-2 text-left font-semibold text-zinc-500">
                #
              </th>
              {result.fields.map(field => (
                <th
                  key={field.name}
                  className="whitespace-nowrap border-b border-zinc-700 bg-zinc-900/95 px-3 py-2 text-left font-semibold text-zinc-300"
                >
                  {field.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
              >
                <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                {result.fields.map(field => {
                  const val = row[field.name];
                  const isNull = val === null;
                  return (
                    <td
                      key={field.name}
                      className={`max-w-xs truncate px-3 py-1.5 ${
                        isNull ? 'italic text-zinc-600' : 'text-zinc-200'
                      }`}
                      title={formatCell(val)}
                    >
                      {formatCell(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
