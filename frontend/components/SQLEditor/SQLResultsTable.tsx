'use client';

import { useMemo } from 'react';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

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
    const t = lang === 'es' ? {
        noResults: 'Ejecuta una query para ver resultados',
        rows: 'filas',
        running: 'Ejecutando...',
        error: 'Error',
    } : {
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
            <div className="flex items-center justify-center gap-2 py-8 text-zinc-400 text-sm">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin" />
                {t.running}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-start gap-2 p-4 text-sm">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                    <div className="text-red-300 font-medium">{t.error}</div>
                    <pre className="text-red-400/80 text-xs mt-1 whitespace-pre-wrap font-mono">{error.error}</pre>
                    {error.durationMs != null && (
                        <div className="flex items-center gap-1 mt-2 text-zinc-500 text-xs">
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
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                {t.noResults}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Status bar */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-800 text-xs text-zinc-400 shrink-0">
                <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    {result.rowCount ?? result.rows.length} {t.rows}
                </span>
                <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {result.durationMs}ms
                </span>
                <span className="text-zinc-600">
                    {result.fields.length} columns
                </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-xs font-mono border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2 text-left text-zinc-500 bg-zinc-900/95 border-b border-zinc-700 font-semibold w-10">
                                #
                            </th>
                            {result.fields.map((field) => (
                                <th
                                    key={field.name}
                                    className="px-3 py-2 text-left text-zinc-300 bg-zinc-900/95 border-b border-zinc-700 font-semibold whitespace-nowrap"
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
                                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                            >
                                <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                                {result.fields.map((field) => {
                                    const val = row[field.name];
                                    const isNull = val === null;
                                    return (
                                        <td
                                            key={field.name}
                                            className={`px-3 py-1.5 max-w-xs truncate ${
                                                isNull ? 'text-zinc-600 italic' : 'text-zinc-200'
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
