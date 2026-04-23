import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from './ResetPasswordForm';
import { resetStrings, type AuthLang } from '../strings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  return {
    title: `${resetStrings[typedLang].reset.eyebrow} · Cairn`,
    description: resetStrings[typedLang].reset.subtitle,
  };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  return (
    <Suspense>
      <ResetPasswordForm lang={typedLang} />
    </Suspense>
  );
}
