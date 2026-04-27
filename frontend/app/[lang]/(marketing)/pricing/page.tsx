import type { Metadata } from 'next';

import { content as contentEn } from '../../content/en';
import { content as contentEs } from '../../content/es';
import PricingView from './PricingView';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const content = lang === 'es' ? contentEs : contentEn;
  return {
    title: `${content.pricing.title} · Operari`,
    description: content.pricing.subtitle,
  };
}

export default async function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const content = lang === 'es' ? contentEs : contentEn;
  return <PricingView content={content.pricing} lang={lang} />;
}
