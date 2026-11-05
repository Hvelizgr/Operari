import Link from 'next/link';

/** Switch between what is running now (Sessions) and past runs (History). */
export function RunsTabs({ lang, active }: { lang: 'en' | 'es'; active: 'live' | 'history' }) {
  const tabs = [
    { id: 'live', href: `/${lang}/sessions`, label: lang === 'es' ? 'En curso' : 'Live' },
    { id: 'history', href: `/${lang}/runs`, label: lang === 'es' ? 'Historial' : 'History' },
  ] as const;
  return (
    <nav
      aria-label={lang === 'es' ? 'Corridas' : 'Runs'}
      className="mb-4 inline-flex rounded-lg border border-[var(--panel-border)] p-0.5"
    >
      {tabs.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={active === tab.id ? 'page' : undefined}
          className={`rounded-md px-3 py-1 text-xs transition-colors ${
            active === tab.id
              ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
