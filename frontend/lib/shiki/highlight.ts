/**
 * Shared shiki highlighter — lazy-loaded once, reused for the rest of
 * the session. Extracted from `components/help/HelpDrawer.tsx` so the
 * audit event log (and any other surface) can reuse the same bundle
 * without forking the shiki import or paying the grammar download
 * twice.
 *
 * Why a singleton: each `createHighlighter` call ships ~50KB per
 * grammar over the wire. A single, app-wide highlighter keeps that
 * cost paid once.
 *
 * The dynamic `import('shiki')` keeps shiki off the critical bundle —
 * it only ships when something actually highlights code (help drawer
 * opens, audit event row expands, etc).
 */

const SHIKI_LANGS = ['sql', 'yaml', 'json', 'bash', 'http', 'plaintext'] as const;
export type ShikiLang = (typeof SHIKI_LANGS)[number];

export type ShikiRender = (code: string, lang: ShikiLang) => string;

let highlighterPromise: Promise<ShikiRender> | null = null;

export function loadHighlighter(): Promise<ShikiRender> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(async shiki => {
      const highlighter = await shiki.createHighlighter({
        themes: ['github-dark-default'],
        langs: SHIKI_LANGS as unknown as string[],
      });
      const render: ShikiRender = (code, lang) =>
        highlighter.codeToHtml(code, {
          lang,
          theme: 'github-dark-default',
        });
      return render;
    });
  }
  return highlighterPromise;
}

export function isShikiLang(lang: string): lang is ShikiLang {
  return (SHIKI_LANGS as readonly string[]).includes(lang);
}
