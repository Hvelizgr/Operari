'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * HelpDrawer — generic slide-in cheatsheet container shared by the
 * three editor surfaces (SQL, HTTP, runbook). Each editor passes its
 * own `topics` array; this component handles the shell:
 *
 *   - Slide-in from the right + dark-themed chrome.
 *   - Esc / backdrop click / X close.
 *   - Quick-jump nav chips at the top.
 *   - Auto-scroll to `initialTopicId` on open and on changes (via a
 *     ref-keyed effect so a manual chip click doesn't get clobbered).
 *
 * Topic content is `ReactNode` so each domain can render its own
 * mix of syntax blocks, hints, and lists. Use the exported
 * `SyntaxBlock` helper for code snippets — it carries copy + insert
 * affordances and matches the SQL-editor visual baseline.
 */

export interface HelpTopic {
  id: string;
  /** Short emoji prefix shown in the nav chip + section header. */
  emoji: string;
  /** Per-language label rendered in nav + section header. */
  label: { en: string; es: string };
  /** Section body. Free-form ReactNode per language. */
  body: { en: React.ReactNode; es: React.ReactNode };
}

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  topics: HelpTopic[];
  /** Title rendered in the header. EN+ES. */
  title: { en: string; es: string };
  /** One-line subtitle under the title. EN+ES. */
  subtitle: { en: string; es: string };
  /** Topic id to scroll to on open / when changed while open. */
  initialTopicId?: string | null;
}

interface SyntaxBlockProps {
  /** The code to render. Newlines preserved. */
  code: string;
  /** Optional callback wired to the editor's insert path; when set,
   *  an "insert into editor" affordance shows on hover. */
  onInsert?: (code: string) => void;
  lang: 'en' | 'es';
  /** Source language for shiki highlighting. Common values across
   *  Operari surfaces: `sql`, `yaml`, `json`, `bash`, `http`,
   *  `plaintext`. Defaults to plaintext when omitted. */
  syntax?: string;
}

/** Languages we ship in the shiki highlighter bundle. Adding a new
 *  one here is the only change needed for new help-drawer surfaces.
 *  Kept narrow on purpose — every extra language is ~50KB of grammar
 *  data lazy-loaded on first highlight. */
const SHIKI_LANGS = ['sql', 'yaml', 'json', 'bash', 'http', 'plaintext'] as const;
type ShikiLang = (typeof SHIKI_LANGS)[number];

/**
 * Lazy shiki highlighter. Loaded on first call, reused for the rest
 * of the session. The dynamic `import('shiki')` keeps shiki off the
 * critical bundle — it only ships when the operator actually opens
 * a help drawer with a code block.
 */
type ShikiRender = (code: string, lang: ShikiLang) => string;

let highlighterPromise: Promise<ShikiRender> | null = null;

function loadHighlighter(): Promise<ShikiRender> {
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

/**
 * Code snippet box with copy + insert affordances + lazy shiki
 * syntax highlighting. Exported so domain-specific topic builders
 * can compose richer bodies without each rebuilding the same
 * scaffolding.
 *
 * Highlighting is opportunistic: until shiki resolves we render the
 * raw `<pre>` so the operator sees something immediately. When the
 * highlighter resolves we swap in the colorized HTML. Unknown
 * languages fall back to `plaintext` (still gets the dark-themed
 * background but no token coloring).
 */
export function SyntaxBlock({ code, onInsert, lang, syntax }: SyntaxBlockProps) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const requestedLang: ShikiLang = (
    syntax && (SHIKI_LANGS as readonly string[]).includes(syntax) ? syntax : 'plaintext'
  ) as ShikiLang;

  useEffect(() => {
    let cancelled = false;
    loadHighlighter()
      .then(render => {
        if (cancelled) return;
        try {
          setHtml(render(code, requestedLang));
        } catch {
          // Grammar fail — leave the plain pre fallback in place.
          setHtml(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, requestedLang]);

  return (
    <div className="group relative my-2 rounded border border-zinc-800 bg-black/40">
      {html ? (
        // shiki produces a self-contained <pre><code>...</code></pre>
        // already styled by the github-dark-default theme; we wrap
        // it in our overflow + padding scaffolding. dangerouslySet
        // is safe here — the source is our own static help content,
        // not user input.
        <div
          className="rb-shiki overflow-x-auto p-2.5 text-[11px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-2.5 font-mono text-[11px] leading-relaxed text-emerald-200">
          {code}
        </pre>
      )}
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="pointer-events-auto rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-300 hover:border-zinc-500 hover:text-white"
          title={lang === 'es' ? 'Copiar' : 'Copy'}
        >
          {copied ? (lang === 'es' ? '¡copiado!' : 'copied!') : lang === 'es' ? 'copiar' : 'copy'}
        </button>
        {onInsert ? (
          <button
            type="button"
            onClick={() => onInsert(code)}
            className="pointer-events-auto rounded border border-emerald-700 bg-emerald-900/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/70"
            title={lang === 'es' ? 'Insertar en el editor' : 'Insert into editor'}
          >
            {lang === 'es' ? 'insertar' : 'insert'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Inline keyword pill — useful inside body prose to call out a verb,
 * header name, or status code without dropping into a full
 * SyntaxBlock. Exported so topic builders can compose tight prose.
 */
export const HelpKW = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-zinc-800 px-1 py-px font-mono text-[10px] text-emerald-300">
    {children}
  </code>
);

/**
 * Amber-tinted hint box for "watch out for X" callouts inside a topic
 * body. Slightly louder than a regular paragraph; quieter than an
 * actual error.
 */
export const HelpHint = ({ children }: { children: React.ReactNode }) => (
  <p className="my-1.5 rounded border border-amber-700/40 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200/90">
    {children}
  </p>
);

/**
 * Body paragraph. Domain builders can pass `className` to override
 * spacing / weight when composing multi-paragraph sections.
 */
export const HelpP = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <p className={`text-[12px] leading-relaxed text-zinc-300 ${className ?? ''}`}>{children}</p>;

export function HelpDrawer({
  open,
  onClose,
  lang,
  topics,
  title,
  subtitle,
  initialTopicId,
}: HelpDrawerProps) {
  const fallbackId = useMemo(() => topics[0]?.id ?? '', [topics]);
  const [activeId, setActiveId] = useState<string>(
    initialTopicId && topics.some(t => t.id === initialTopicId) ? initialTopicId : fallbackId
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Esc closes — listener attached only while the drawer is open so
  // we don't intercept Esc presses meant for other modals.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Auto-jump on open / when initialTopicId changes while open.
  // Tracks the last value written so manual chip clicks don't get
  // clobbered by the next render — only verb / method *changes*
  // re-anchor.
  const lastInitialRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (!initialTopicId) return;
    if (lastInitialRef.current === initialTopicId) return;
    lastInitialRef.current = initialTopicId;
    if (!topics.some(t => t.id === initialTopicId)) return;
    setActiveId(initialTopicId);
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-topic="${initialTopicId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialTopicId, topics]);

  const scrollToTopic = (id: string) => {
    setActiveId(id);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-topic="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!open) return null;
  const closeLabel = lang === 'es' ? 'Cerrar' : 'Close';
  const kbdLabel = 'Esc';

  return (
    <>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-label={title[lang]}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(640px,95vw)] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-100">{title[lang]}</span>
            <span className="text-[11px] text-zinc-500">{subtitle[lang]}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">
              {kbdLabel}
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <nav className="flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-900/30 px-3 py-2">
          {topics.map(topic => (
            <button
              key={topic.id}
              type="button"
              onClick={() => scrollToTopic(topic.id)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                activeId === topic.id
                  ? 'bg-emerald-700/30 text-emerald-200'
                  : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
              }`}
            >
              <span className="mr-1">{topic.emoji}</span>
              {topic.label[lang]}
            </button>
          ))}
        </nav>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {topics.map((topic, i) => (
            <section key={topic.id} data-topic={topic.id} className={i === 0 ? '' : 'mt-6'}>
              <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-zinc-100">
                <span>{topic.emoji}</span>
                {topic.label[lang]}
              </h3>
              <div className="space-y-1.5">{topic.body[lang]}</div>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
