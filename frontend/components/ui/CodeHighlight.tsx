'use client';

import { useEffect, useState } from 'react';

import { isShikiLang, loadHighlighter, type ShikiLang } from '@/lib/shiki/highlight';

interface CodeHighlightProps {
  code: string;
  /** Source language. Falls back to `plaintext` for unknown values. */
  syntax?: string;
  /** Wrapper className applied around the rendered code. */
  className?: string;
}

/**
 * Tiny shiki-backed code renderer. Drops the colored HTML into a
 * `<div dangerouslySetInnerHTML>` once the highlighter resolves;
 * until then it shows a plain `<pre>` so the operator never stares
 * at an empty box while shiki ships.
 *
 * Use this anywhere a payload / config / log fragment needs syntax
 * coloring outside the help drawer (audit event payloads, JSON
 * inspectors, captured request bodies). The help drawer's
 * `SyntaxBlock` keeps its own copy + insert chrome — this component
 * is the bare-minimum shell.
 */
export function CodeHighlight({ code, syntax = 'plaintext', className }: CodeHighlightProps) {
  const [html, setHtml] = useState<string | null>(null);
  const lang: ShikiLang = isShikiLang(syntax) ? syntax : 'plaintext';

  useEffect(() => {
    let cancelled = false;
    loadHighlighter()
      .then(render => {
        if (cancelled) return;
        try {
          setHtml(render(code, lang));
        } catch {
          setHtml(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (html) {
    return (
      <div
        // shiki ships its own <pre><code> wrapper themed by
        // github-dark-default. We strip its background so the
        // surrounding panel's bg shows through, and let our
        // wrapper own padding + scroll behaviour.
        className={`rb-shiki [&_pre]:!bg-transparent [&_pre]:!p-0 ${className ?? ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <pre
      className={`overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300 ${className ?? ''}`}
    >
      {code}
    </pre>
  );
}
