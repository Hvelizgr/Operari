import { format, formatDistanceToNow } from 'date-fns';
import { enUS, es } from 'date-fns/locale';

type Lang = 'en' | 'es';

/**
 * Locale-aware datetime helpers built on date-fns. Centralised so:
 *   1. Every screen formats timestamps with the same shape (no
 *      mixture of "5/2/2024, 3:30:45 PM" from `toLocaleString()` —
 *      which is browser-locale-dependent — and date-fns output).
 *   2. The locale lookup happens once: `lang === 'es' ? es : enUS`.
 *   3. Future format tweaks (12h vs 24h, with/without seconds) land
 *      in one file.
 *
 * Two patterns cover ~all timestamp UI we have:
 *
 *   - `formatDateTime(ts, lang)`  — long, audit-style: "May 2, 2024
 *     at 3:30 PM" / "2 may 2024 a las 15:30". Use for tables, run
 *     headers, audit rows, anything where the absolute time matters.
 *   - `formatRelative(ts, lang)`  — "2 minutes ago" / "hace 2 min".
 *     Use for sidebars, recent-activity strips.
 */

export function formatDateTime(ts: string | number | Date, lang: Lang): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  return format(date, 'PPpp', { locale: lang === 'es' ? es : enUS });
}

export function formatRelative(ts: string | number | Date, lang: Lang): string {
  return formatDistanceToNow(ts, {
    addSuffix: true,
    locale: lang === 'es' ? es : enUS,
  });
}
