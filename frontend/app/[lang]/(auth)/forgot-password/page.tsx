import type { Metadata } from 'next';
import { ForgotPasswordForm } from './ForgotPasswordForm';
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
    title: `${resetStrings[typedLang].forgot.eyebrow} · Cairn`,
    description: resetStrings[typedLang].forgot.subtitle,
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const typedLang: AuthLang = lang === 'es' ? 'es' : 'en';
  return <ForgotPasswordForm lang={typedLang} />;
}
