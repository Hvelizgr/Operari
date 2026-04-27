import type { Metadata } from 'next';

import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import TriggersView from './TriggersView';

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
  return {
    title: `${c.triggers.title} · Operari`,
    description: c.triggers.subtitle,
  };
}

export default async function TriggersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  return <TriggersView triggers={c.triggers} lang={lang} />;
}
