import Link from 'next/link';

const STRINGS = {
  en: {
    titleMissing: 'Missing verification link.',
    bodyMissing: 'The URL does not contain a token. Re-open the link from the email we sent.',
    titleInvalid: 'Verification link is no longer valid.',
    bodyInvalid:
      'The link may have expired (they\'re good for 7 days) or already been used. Sign in and click "Resend link" from the dashboard banner.',
    titleServer: 'Something went wrong.',
    bodyServer: 'Try the link again in a minute, or resend a fresh one from the dashboard.',
    goLogin: 'Sign in',
    goHome: 'Back to home',
  },
  es: {
    titleMissing: 'El link no trae token.',
    bodyMissing: 'La URL no contiene token. Reabrí el link desde el mail que te mandamos.',
    titleInvalid: 'El link de verificación ya no sirve.',
    bodyInvalid:
      'Puede que haya expirado (duran 7 días) o ya fue usado. Iniciá sesión y tocá "Reenviar link" desde la banda del dashboard.',
    titleServer: 'Algo falló.',
    bodyServer: 'Reintentá en un minuto o pedí un link nuevo desde el dashboard.',
    goLogin: 'Iniciar sesión',
    goHome: 'Volver al inicio',
  },
} as const;

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { lang } = await params;
  const { error } = await searchParams;
  const typedLang: 'en' | 'es' = lang === 'es' ? 'es' : 'en';
  const t = STRINGS[typedLang];

  let title: string = t.titleServer;
  let body: string = t.bodyServer;
  if (error === 'missing_token') {
    title = t.titleMissing;
    body = t.bodyMissing;
  } else if (error === 'invalid_or_expired') {
    title = t.titleInvalid;
    body = t.bodyInvalid;
  }

  return (
    <div className="border-border/60 bg-card/40 rounded-2xl border p-6 shadow-xl shadow-black/10 sm:p-8">
      <h1 className="text-foreground text-3xl font-bold leading-tight tracking-tight">{title}</h1>
      <p className="text-muted-foreground mt-3 text-sm">{body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <Link
          href={`/${typedLang}/login`}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-colors"
        >
          {t.goLogin}
        </Link>
        <Link
          href={`/${typedLang}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t.goHome}
        </Link>
      </div>
    </div>
  );
}
