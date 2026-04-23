import type { Metadata } from 'next';

import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import DocsPage from '../_shared/DocsPage';

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
  return { title: `${c.terms.title} · NanoRun`, description: c.terms.subtitle };
}

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  return (
    <DocsPage
      {...c.terms}
      numberStyle="section"
      tocLabel={lang === 'es' ? 'Tabla de contenidos' : 'Table of contents'}
    />
  );
}
