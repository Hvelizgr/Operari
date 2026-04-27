import type { Metadata } from 'next';
import Link from 'next/link';

import { DNAMark } from '@/components/Brand/DNAMark';

import { AcceptInviteForm } from './AcceptInviteForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: lang === 'es' ? 'Aceptar invitación · Operari' : 'Accept invite · Operari',
    robots: { index: false, follow: false },
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang, token } = await params;
  const typedLang: 'en' | 'es' = lang === 'es' ? 'es' : 'en';
  return (
    <div className="bg-background text-foreground dark flex min-h-screen flex-col">
      <header className="relative z-10 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href={`/${typedLang}`} className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 shadow-lg shadow-emerald-500/10">
              <DNAMark size={20} />
            </div>
            <span className="text-foreground text-lg font-bold tracking-tight">Operari</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="w-full max-w-md">
          <AcceptInviteForm token={token} lang={typedLang} />
        </div>
      </main>
    </div>
  );
}
