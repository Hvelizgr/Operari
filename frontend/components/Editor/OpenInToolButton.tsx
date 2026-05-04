'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

/**
 * Reverse handoff — from a runbook step in the editor back to the
 * SQL editor / API tester surface where the operator can iterate
 * the query / request with the full ergonomics of the dedicated
 * tool (schema browser, history sidebar, cheatsheet drawer, etc.)
 * and then send it back via the existing forward handoff
 * (PendingStepBanner).
 *
 * Round-trip story:
 *   1. operator inspects an `operari.database` step
 *   2. clicks "Open in SQL Editor"
 *   3. lands on /sql-editor with the query + connection prefilled
 *      (via localStorage prefill key the SQL editor reads on mount)
 *   4. iterates → clicks "To runbook" → forward handoff fires
 *   5. comes back to the editor → PendingStepBanner offers to
 *      replace this same step (or insert new — operator picks)
 *
 * Why localStorage and not query params: SQL queries can be many
 * kilobytes; URLs cap at 2-8 KB across browsers. Same reason the
 * forward handoff uses localStorage. Symmetry > clever URL
 * encoding.
 */

interface DbStepConfig {
  query?: string;
  credentialId?: string;
}

interface HttpStepConfig {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface Props {
  type: 'operari.database' | 'operari.httpRequest';
  config: Record<string, unknown>;
  lang: 'en' | 'es';
}

const PREFILL_DB_KEY = 'operari:prefillSqlEditor';
const PREFILL_HTTP_KEY = 'operari:prefillHttpTester';

export default function OpenInToolButton({ type, config, lang }: Props) {
  const isDb = type === 'operari.database';
  const dest = isDb ? '/sql-editor' : '/http-tester';
  // Honour the lang segment if the editor was loaded under /es or /en.
  // Falls back to no-prefix when running from a path that doesn't
  // include a locale (e.g. a localhost dev session that lands on root).
  const localeSegment =
    typeof window !== 'undefined' && /^\/(es|en)\b/.test(window.location.pathname)
      ? `/${window.location.pathname.split('/')[1]}`
      : '';

  const t =
    lang === 'es'
      ? {
          dbLabel: 'Abrir en SQL Editor',
          httpLabel: 'Abrir en Probador API',
          hint: 'Iterá la consulta en el surface dedicado y mandala de vuelta cuando esté lista.',
        }
      : {
          dbLabel: 'Open in SQL Editor',
          httpLabel: 'Open in API Tester',
          hint: 'Iterate the query in the dedicated surface and send it back when ready.',
        };

  const handleClick = () => {
    try {
      if (isDb) {
        const c = config as DbStepConfig;
        window.localStorage.setItem(
          PREFILL_DB_KEY,
          JSON.stringify({
            query: typeof c.query === 'string' ? c.query : '',
            credentialId: typeof c.credentialId === 'string' ? c.credentialId : '',
            createdAt: Date.now(),
          })
        );
      } else {
        const c = config as HttpStepConfig;
        window.localStorage.setItem(
          PREFILL_HTTP_KEY,
          JSON.stringify({
            method: typeof c.method === 'string' ? c.method : 'GET',
            url: typeof c.url === 'string' ? c.url : '',
            headers: c.headers && typeof c.headers === 'object' ? c.headers : {},
            body: typeof c.body === 'string' ? c.body : '',
            createdAt: Date.now(),
          })
        );
      }
    } catch {
      // localStorage failure — the tool will still open, just empty.
    }
  };

  return (
    <Link
      href={`${localeSegment}${dest}`}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded border border-violet-700/50 bg-violet-950/30 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition-colors hover:border-violet-600 hover:bg-violet-900/40"
      title={t.hint}
    >
      <ExternalLink size={11} />
      {isDb ? t.dbLabel : t.httpLabel}
    </Link>
  );
}

export { PREFILL_DB_KEY, PREFILL_HTTP_KEY };
