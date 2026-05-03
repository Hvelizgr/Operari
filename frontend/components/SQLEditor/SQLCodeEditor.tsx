'use client';

import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useCallback, useRef } from 'react';

/**
 * SQL editor — Sprint 3 migration from a hand-rolled
 * textarea-with-overlay-highlight to CodeMirror 6 via
 * `@uiw/react-codemirror` + `@codemirror/lang-sql`.
 *
 * Why migrate: the previous component re-implemented syntax
 * highlighting, scroll-sync, tab indent, and Ctrl+Enter via three
 * stacked elements. CodeMirror 6 does all four out of the box, plus
 * line numbers, autocomplete (PG-aware via lang-sql's keywords),
 * proper undo, multi-cursor, search/replace.
 *
 * Public API preserved: same `value` / `onChange` / `onRun` /
 * `readOnly` / `minHeight` / `placeholder` shape so every call site
 * (this page + the runbook editor's `database` step config field)
 * works without changes.
 */

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
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // Ctrl/Cmd+Enter triggers `onRun`. CodeMirror's keymap is the
  // proper way to do this but the bare onKeyDown is simpler and
  // matches what the rest of the editor expects (Ctrl+Enter from
  // any focus). preventDefault stops the default newline.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onRun?.();
      }
    },
    [onRun]
  );

  return (
    <div onKeyDown={handleKeyDown} style={{ minHeight }} className="sql-editor-wrapper">
      <CodeMirror
        ref={editorRef}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        theme={vscodeDark}
        extensions={[sql()]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          indentOnInput: true,
          tabSize: 2,
        }}
        height="100%"
        minHeight={minHeight}
        style={{
          fontSize: '13px',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      />
    </div>
  );
}
