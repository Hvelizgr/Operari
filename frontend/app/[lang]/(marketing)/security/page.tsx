import type { Metadata } from 'next';

import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import SecurityView from './SecurityView';

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
  return { title: `${c.security.title} · Operari`, description: c.security.subtitle };
}

export default async function SecurityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  return <SecurityView content={c.security} lang={lang} />;
}
