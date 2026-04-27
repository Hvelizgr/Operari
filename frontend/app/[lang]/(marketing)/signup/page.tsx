import { ArrowRight, Github, Mail, Terminal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { repo } from '@/config/repo.config';

import RunPreview from './RunPreview';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const title = lang === 'es' ? 'Obtener API key' : 'Get API key';
  return {
    title: `${title} · Operari`,
    description:
      lang === 'es'
        ? 'La API hospedada de Operari está en alpha privada. Dejá tu email o self-host mientras tanto.'
        : 'The hosted Operari API is in private alpha. Leave your email or self-host in the meantime.',
  };
}

const STRINGS = {
  en: {
    eyebrow: 'Hosted API · Private alpha',
    title: 'Get an API key.',
    subtitle:
      'The hosted Operari API is in private alpha while we sign early design partners. Tell us what you want to automate and we will get back within 48 hours.',
    emailLabel: 'Email us',
    emailHint: 'hello@operari.dev — tell us one runbook you want to trigger from the API.',
    orLine: 'Or skip the waitlist and self-host today:',
    selfHostCommand: 'docker compose up',
    selfHostNote: 'AGPL-3.0 · no telemetry · no sign-up',
    githubCta: 'Self-host on GitHub',
    back: 'Back to home',
    accountLine: 'Already using a self-hosted workspace?',
    loginCta: 'Sign in',
    registerCta: 'Create account',
    previewCaption: 'This is what your runbook does the moment we open the API to you.',
  },
  es: {
    eyebrow: 'API hospedada · Alpha privada',
    title: 'Obtené una API key.',
    subtitle:
      'La API hospedada de Operari está en alpha privada mientras cerramos design partners. Contanos qué querés automatizar y te escribimos en 48 horas.',
    emailLabel: 'Escribinos',
    emailHint: 'hello@operari.dev — contanos un runbook que quieras disparar por API.',
    orLine: 'O saltate la lista de espera y self-hosteá hoy:',
    selfHostCommand: 'docker compose up',
    selfHostNote: 'AGPL-3.0 · sin telemetría · sin signup',
    githubCta: 'Self-host en GitHub',
    back: 'Volver al inicio',
    accountLine: '¿Ya usás un workspace self-hosted?',
    loginCta: 'Iniciar sesión',
    registerCta: 'Crear cuenta',
    previewCaption: 'Esto hace tu runbook el segundo que te abrimos la API.',
  },
} as const;

export default async function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = (lang === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[typedLang];

  return (
    <main className="bg-background selection:bg-primary/20 relative min-h-[88vh] flex-1 pb-24 pt-28 sm:pt-32">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr,1.1fr] lg:gap-16">
          {/* LEFT — copy + email + self-host */}
          <div>
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-1.5 w-1.5 rounded-full" />
              </span>
              {t.eyebrow}
            </span>

            <h1 className="text-foreground mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-6xl">
              {t.title}
            </h1>

            <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              {t.subtitle}
            </p>

            <div className="border-border bg-card/60 mt-10 rounded-2xl border p-5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-6">
              <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                {t.emailLabel}
              </div>
              <a
                href="mailto:hello@operari.dev?subject=Operari%20API%20access&body=Hi%2C%20I%27d%20like%20an%20API%20key.%20One%20runbook%20I%27d%20trigger%3A%20"
                className="bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 group inline-flex items-center gap-3 rounded-xl px-5 py-3 font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
              >
                <Mail className="h-4 w-4" />
                hello@operari.dev
                <ArrowRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="text-muted-foreground/80 mt-3 text-xs">{t.emailHint}</p>
            </div>

            <div className="border-border/60 mt-8 border-t pt-6">
              <p className="text-muted-foreground mb-3 text-sm">{t.orLine}</p>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="border-border bg-card/50 text-foreground/80 inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs">
                  <Terminal className="text-primary h-3.5 w-3.5" />
                  <span>{t.selfHostCommand}</span>
                </div>
                <Link
                  href={repo.base}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border hover:border-primary/40 text-foreground/80 hover:text-foreground inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors"
                >
                  <Github className="h-3.5 w-3.5" />
                  {t.githubCta}
                </Link>
              </div>
              <p className="text-muted-foreground/70 mt-3 text-[11px]">{t.selfHostNote}</p>
            </div>

            <div className="border-border/60 text-muted-foreground mt-8 border-t pt-6 text-sm">
              {t.accountLine}{' '}
              <Link
                href={`/${typedLang}/login`}
                className="text-primary hover:text-primary/90 font-medium transition-colors"
              >
                {t.loginCta}
              </Link>
              {' · '}
              <Link
                href={`/${typedLang}/register`}
                className="text-primary hover:text-primary/90 font-medium transition-colors"
              >
                {t.registerCta}
              </Link>
            </div>

            <div className="mt-10">
              <Link
                href={`/${typedLang}`}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                ← {t.back}
              </Link>
            </div>
          </div>

          {/* RIGHT — auto-running YAML preview */}
          <div className="hidden lg:block">
            <RunPreview lang={typedLang} />
            <p className="text-muted-foreground mx-auto mt-4 max-w-md text-center font-mono text-[11px]">
              {t.previewCaption}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
