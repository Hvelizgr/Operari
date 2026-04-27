import type { Metadata } from 'next';

import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import ProductView from './ProductView';

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
    title: `${c.story.title} · Operari`,
    description: c.story.subtitle,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  return <ProductView story={c.story} safety={c.safety} lang={lang} />;
}
