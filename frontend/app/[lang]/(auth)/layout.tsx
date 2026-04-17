import Link from 'next/link';

export default async function AuthLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
}) {
    const { lang } = await params;

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground dark">
            <header className="relative z-10 px-4 sm:px-6 py-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Link href={`/${lang}`} className="flex items-center gap-2.5 group">
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
                    <Link
                        href={`/${lang}`}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← {lang === 'es' ? 'Volver al inicio' : 'Back to home'}
                    </Link>
                </div>
            </header>
            <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-10 sm:py-16">
                <div className="w-full max-w-md">{children}</div>
            </main>
        </div>
    );
}
