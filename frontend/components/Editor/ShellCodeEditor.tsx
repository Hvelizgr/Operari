'use client';

import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import CodeMirror from '@uiw/react-codemirror';

/**
 * Shell command editor — Sprint 3 sibling to SQLCodeEditor. Wraps
 * `@uiw/react-codemirror` with the legacy `shell` mode so bash/sh
 * snippets in the runbook step config get tokenised quoting,
 * variable expansion, and pipe highlighting instead of being a flat
 * monospace blob.
 *
 * Why legacy-modes vs a dedicated lang-shell: there is no first-party
 * `@codemirror/lang-shell` yet. The legacy `shell` mode is enough for
 * the operator's read pattern (a 3-line glance to confirm flags, not
 * a full IDE) and avoids a third-party dep with its own update
 * cadence.
 *
 * Public API matches the inline `<textarea>` it replaces inside
 * DynamicNodeForm: `value` / `onChange` / `minHeight`. No autocomplete
 * — guessing shell tools from a runbook editor would land more wrong
 * than right.
 */

interface ShellCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  placeholder?: string;
}

export default function ShellCodeEditor({
  value,
  onChange,
  minHeight = '120px',
  placeholder = 'echo "hello"',
}: ShellCodeEditorProps) {
  return (
    <div style={{ minHeight }} className="shell-editor-wrapper">
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        theme={vscodeDark}
        extensions={[StreamLanguage.define(shell)]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
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
