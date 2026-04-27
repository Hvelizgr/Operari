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
  return { title: `${c.privacy.title} · Operari`, description: c.privacy.subtitle };
}

export default async function PrivacyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const c = lang === 'es' ? contentEs : contentEn;
  return (
    <DocsPage
      {...c.privacy}
      numberStyle="decimal"
      tocLabel={lang === 'es' ? 'En esta página' : 'On this page'}
    />
  );
}
