import type { Metadata } from 'next';

import { type AuthLang, authStrings } from '../strings';
import { RegisterForm } from './RegisterForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  const title = authStrings[typedLang].register.eyebrow;
  return {
    title: `${title} · Cairn`,
    description: authStrings[typedLang].register.subtitle,
  };
}

export default async function RegisterPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  return <RegisterForm lang={typedLang} />;
}
