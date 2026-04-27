import type { Metadata } from 'next';

import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import SubprocessorsMap from './SubprocessorsMap';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  return { title: `${c.subprocessors.title} · Operari`, description: c.subprocessors.subtitle };
}

export default async function SubprocessorsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  const s = c.subprocessors;

  return (
    <main className="bg-background relative">
      <div className="container mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <header className="mb-10 sm:mb-12">
          <p className="text-primary mb-4 font-mono text-xs uppercase tracking-[0.2em]">
            {s.updated}
          </p>
          <h1 className="text-foreground mb-3 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {s.title}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base sm:text-lg">{s.subtitle}</p>
          <p className="text-muted-foreground mt-6 max-w-2xl text-sm leading-relaxed">{s.intro}</p>
        </header>

        <SubprocessorsMap entries={s.entries} lang={lang} />

        <h2 className="text-muted-foreground mb-4 mt-12 font-mono text-xs uppercase tracking-[0.2em]">
          {lang === 'es' ? 'Lista detallada' : 'Detailed list'}
        </h2>
        <div className="border-border/60 bg-card/40 mb-8 overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/60">
                <tr className="border-border/60 border-b text-left">
                  <th className="text-muted-foreground px-4 py-4 text-[11px] font-semibold uppercase tracking-wider md:px-5">
                    {lang === 'es' ? 'Proveedor' : 'Provider'}
                  </th>
                  <th className="text-muted-foreground px-4 py-4 text-[11px] font-semibold uppercase tracking-wider md:px-5">
                    {lang === 'es' ? 'Propósito' : 'Purpose'}
                  </th>
                  <th className="text-muted-foreground hidden px-4 py-4 text-[11px] font-semibold uppercase tracking-wider sm:table-cell md:px-5">
                    {lang === 'es' ? 'Región' : 'Region'}
                  </th>
                  <th className="text-muted-foreground hidden px-4 py-4 text-[11px] font-semibold uppercase tracking-wider md:table-cell md:px-5">
                    {lang === 'es' ? 'Tipo de datos' : 'Data types'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.entries.map((entry, i) => (
                  <tr
                    key={entry.name}
                    className={`border-border/30 border-b last:border-0 ${i % 2 === 0 ? 'bg-background/[0.02]' : ''}`}
                  >
                    <td className="text-foreground px-4 py-4 font-semibold md:px-5">
                      {entry.name}
                    </td>
                    <td className="text-muted-foreground px-4 py-4 md:px-5">{entry.purpose}</td>
                    <td className="text-muted-foreground hidden px-4 py-4 font-mono text-xs sm:table-cell md:px-5">
                      {entry.region}
                    </td>
                    <td className="text-muted-foreground hidden px-4 py-4 text-xs md:table-cell md:px-5">
                      {entry.dataTypes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-primary/30 bg-primary/5 text-muted-foreground rounded-xl border p-4 text-sm">
          <span className="text-primary mr-1 font-semibold">
            {lang === 'es' ? 'Aviso:' : 'Notice:'}
          </span>
          {s.notice}
        </div>
      </div>
    </main>
  );
}
