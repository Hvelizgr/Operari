import type { Metadata } from 'next';
import Link from 'next/link';
import { AcceptInviteForm } from './AcceptInviteForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ lang: string }>;
}): Promise<Metadata> {
    const { lang } = await params;
    return {
        title: lang === 'es' ? 'Aceptar invitación · Cairn' : 'Accept invite · Cairn',
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
        <div className="flex flex-col min-h-screen bg-background text-foreground dark">
            <header className="relative z-10 px-4 sm:px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Link href={`/${typedLang}`} className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M4 18 L12 6 L20 18 Z" />
                                <path d="M8 14 L16 14" />
                            </svg>
                        </div>
                        <span className="font-bold text-lg tracking-tight text-foreground">Cairn</span>
                    </Link>
                </div>
            </header>
            <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-10 sm:py-16">
                <div className="w-full max-w-md">
                    <AcceptInviteForm token={token} lang={typedLang} />
                </div>
            </main>
        </div>
    );
}
