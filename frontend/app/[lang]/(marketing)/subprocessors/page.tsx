import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import type { Metadata } from 'next';

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
  return { title: `${c.subprocessors.title} · NanoRun`, description: c.subprocessors.subtitle };
}

export default async function SubprocessorsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  const s = c.subprocessors;

  return (
    <main className="relative bg-background">
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl pt-28 pb-24 sm:pt-32">
        <header className="mb-10 sm:mb-14 pb-8 border-b border-border/50">
          <p className="font-mono text-xs text-primary uppercase tracking-[0.2em] mb-4">
            {s.updated}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-3 leading-[1.05]">
            {s.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">{s.subtitle}</p>
        </header>

        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-10">
          {s.intro}
        </p>

        <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/60">
                <tr className="border-b border-border/60 text-left">
                  <th className="px-4 md:px-5 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {lang === 'es' ? 'Proveedor' : 'Provider'}
                  </th>
                  <th className="px-4 md:px-5 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {lang === 'es' ? 'Propósito' : 'Purpose'}
                  </th>
                  <th className="px-4 md:px-5 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground hidden sm:table-cell">
                    {lang === 'es' ? 'Región' : 'Region'}
                  </th>
                  <th className="px-4 md:px-5 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:table-cell">
                    {lang === 'es' ? 'Tipo de datos' : 'Data types'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.entries.map((entry, i) => (
                  <tr
                    key={entry.name}
                    className={`border-b border-border/30 last:border-0 ${i % 2 === 0 ? 'bg-background/[0.02]' : ''}`}
                  >
                    <td className="px-4 md:px-5 py-4 font-semibold text-foreground">{entry.name}</td>
                    <td className="px-4 md:px-5 py-4 text-muted-foreground">{entry.purpose}</td>
                    <td className="px-4 md:px-5 py-4 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {entry.region}
                    </td>
                    <td className="px-4 md:px-5 py-4 text-xs text-muted-foreground hidden md:table-cell">
                      {entry.dataTypes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-primary mr-1">
            {lang === 'es' ? 'Aviso:' : 'Notice:'}
          </span>
          {s.notice}
        </div>
      </div>
    </main>
  );
}
