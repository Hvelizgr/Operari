'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Lightweight SQL editor with syntax highlighting overlay.
 *
 * Reusable — used by both the standalone SQL editor page and the
 * database node's query field in the runbook editor. Intentionally
 * avoids heavy deps like Monaco or CodeMirror; syntax highlighting
 * is done via a transparent textarea over a highlighted pre.
 *
 * Props:
 *   value / onChange — controlled component
 *   onRun — called on Ctrl+Enter (execute query)
 *   readOnly — disables editing
 *   minHeight — CSS min-height (default '120px')
 */

const SQL_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'NULL',
  'JOIN',
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
  'OUTER',
  'CROSS',
  'ON',
  'GROUP',
  'BY',
  'ORDER',
  'ASC',
  'DESC',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'CREATE',
  'TABLE',
  'ALTER',
  'DROP',
  'INDEX',
  'VIEW',
  'AS',
  'DISTINCT',
  'UNION',
  'ALL',
  'EXCEPT',
  'INTERSECT',
  'EXISTS',
  'BETWEEN',
  'LIKE',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'CAST',
  'COALESCE',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'TRUE',
  'FALSE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'WITH',
  'RECURSIVE',
  'RETURNING',
  'PRIMARY',
  'KEY',
  'FOREIGN',
  'REFERENCES',
  'CONSTRAINT',
  'DEFAULT',
  'NOT',
  'CHECK',
  'UNIQUE',
  'CASCADE',
  'RESTRICT',
  'TRIGGER',
  'BOOLEAN',
  'INTEGER',
  'TEXT',
  'VARCHAR',
  'TIMESTAMP',
  'UUID',
  'JSONB',
  'SERIAL',
  'BIGINT',
  'SMALLINT',
  'NUMERIC',
  'REAL',
  'DOUBLE',
]);

const SQL_FUNCTIONS = new Set([
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COALESCE',
  'NULLIF',
  'CAST',
  'EXTRACT',
  'NOW',
  'CURRENT_TIMESTAMP',
  'CURRENT_DATE',
  'LOWER',
  'UPPER',
  'TRIM',
  'LENGTH',
  'SUBSTRING',
  'CONCAT',
  'ARRAY_AGG',
  'STRING_AGG',
  'JSON_AGG',
  'JSONB_AGG',
  'ROW_NUMBER',
  'RANK',
  'DENSE_RANK',
  'LAG',
  'LEAD',
  'OVER',
  'PARTITION',
  'GENERATE_SERIES',
  'UNNEST',
  'EXISTS',
]);

function highlightSQL(sql: string): string {
  // Escape HTML
  let html = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Comments (-- line comments)
  html = html.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>');

  // Strings ('...')
  html = html.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="sql-string">$1</span>');

  // Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="sql-number">$1</span>');

  // Keywords and functions (word boundary match)
  html = html.replace(/\b([A-Z_]+)\b/gi, match => {
    const upper = match.toUpperCase();
    if (SQL_KEYWORDS.has(upper)) {
      return `<span class="sql-keyword">${match}</span>`;
    }
    if (SQL_FUNCTIONS.has(upper)) {
      return `<span class="sql-function">${match}</span>`;
    }
    return match;
  });

  return html;
}

interface SQLCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  readOnly?: boolean;
  minHeight?: string;
  placeholder?: string;
}

export default function SQLCodeEditor({
  value,
  onChange,
  onRun,
  readOnly = false,
  minHeight = '120px',
  placeholder = 'SELECT * FROM ...',
}: SQLCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Sync scroll between textarea and highlighted overlay
  const syncScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Handle Tab key for indentation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = value.slice(0, start) + '  ' + value.slice(end);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      // Ctrl+Enter to run
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onRun?.();
      }
    },
    [value, onChange, onRun]
  );

  const highlighted = highlightSQL(value || '');

  return (
    <div className="sql-editor-wrapper" style={{ minHeight, position: 'relative' }}>
      <style>{`
                .sql-editor-wrapper {
                    position: relative;
                    border: 1px solid var(--border-color, #2d2d44);
                    border-radius: 6px;
                    overflow: hidden;
                    background: #0a0a1a;
                }
                .sql-editor-wrapper:focus-within {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
                }
                .sql-editor-pre,
                .sql-editor-textarea {
                    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    padding: 12px;
                    margin: 0;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    overflow: auto;
                    width: 100%;
                    min-height: inherit;
                    box-sizing: border-box;
                    tab-size: 2;
                }
                .sql-editor-pre {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    color: #e2e8f0;
                    z-index: 1;
                }
                .sql-editor-textarea {
                    position: relative;
                    z-index: 2;
                    color: transparent;
                    caret-color: #e2e8f0;
                    background: transparent;
                    border: none;
                    outline: none;
                    resize: vertical;
                }
                .sql-keyword { color: #c084fc; font-weight: 600; }
                .sql-function { color: #38bdf8; }
                .sql-string { color: #86efac; }
                .sql-number { color: #fbbf24; }
                .sql-comment { color: #64748b; font-style: italic; }
            `}</style>
      <pre
        ref={preRef}
        className="sql-editor-pre"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
      />
      <textarea
        ref={textareaRef}
        className="sql-editor-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
