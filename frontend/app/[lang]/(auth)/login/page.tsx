import type { Metadata } from 'next';
import { Suspense } from 'react';

import { type AuthLang, authStrings } from '../strings';
import { LoginForm } from './LoginForm';

// Auth pages read search params (`?redirect=…`) and tie to per-request
// session state, so they must render dynamically. Static prerender would
// also break the Suspense boundary that useSearchParams() requires.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  const title = authStrings[typedLang].login.eyebrow;
  return {
    title: `${title} · Cairn`,
    description: authStrings[typedLang].login.subtitle,
  };
}

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  return (
    <Suspense>
      <LoginForm lang={typedLang} />
    </Suspense>
  );
}
