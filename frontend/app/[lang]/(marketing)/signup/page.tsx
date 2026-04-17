import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Terminal, Github, Mail } from 'lucide-react';
import { repo } from '@/config/repo.config';

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
    title: `${title} · Cairn`,
    description:
      lang === 'es'
        ? 'La API hospedada de Cairn está en alpha privada. Dejá tu email o self-host mientras tanto.'
        : 'The hosted Cairn API is in private alpha. Leave your email or self-host in the meantime.',
  };
}

const STRINGS = {
  en: {
    eyebrow: 'Hosted API · Private alpha',
    title: 'Get an API key.',
    subtitle:
      'The hosted Cairn API is in private alpha while we sign early design partners. Tell us what you want to automate and we will get back within 48 hours.',
    emailLabel: 'Email us',
    emailHint: 'hello@cairn.run — tell us one runbook you want to trigger from the API.',
    orLine: 'Or skip the waitlist and self-host today:',
    selfHostCommand: 'docker compose up',
    selfHostNote: 'AGPL-3.0 · no telemetry · no sign-up',
    githubCta: 'Self-host on GitHub',
    back: 'Back to home',
  },
  es: {
    eyebrow: 'API hospedada · Alpha privada',
    title: 'Obtené una API key.',
    subtitle:
      'La API hospedada de Cairn está en alpha privada mientras cerramos design partners. Contanos qué querés automatizar y te escribimos en 48 horas.',
    emailLabel: 'Escribinos',
    emailHint: 'hello@cairn.run — contanos un runbook que quieras disparar por API.',
    orLine: 'O saltate la lista de espera y self-hosteá hoy:',
    selfHostCommand: 'docker compose up',
    selfHostNote: 'AGPL-3.0 · sin telemetría · sin signup',
    githubCta: 'Self-host en GitHub',
    back: 'Volver al inicio',
  },
} as const;

export default async function SignupPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const typedLang = (lang === 'es' ? 'es' : 'en') as 'en' | 'es';
  const t = STRINGS[typedLang];

  return (
    <main className="relative flex-1 bg-background selection:bg-primary/20 pt-28 sm:pt-32 pb-24">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            {t.eyebrow}
          </span>

          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.05] text-foreground">
            {t.title}
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
            {t.subtitle}
          </p>

          {/* Email capture — just a mailto link today. A real waitlist form
              (Resend + list sync) goes here once we decide the wedge.
              For now `mailto:` is honest: a pre-launch product asking its
              first users to literally email the founder beats a fake form
              that pretends there's a queue. */}
          <div className="mt-10 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-5 sm:p-6 shadow-xl shadow-black/20">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
              {t.emailLabel}
            </div>
            <a
              href="mailto:hello@cairn.run?subject=Cairn%20API%20access&body=Hi%2C%20I%27d%20like%20an%20API%20key.%20One%20runbook%20I%27d%20trigger%3A%20"
              className="group inline-flex items-center gap-3 rounded-xl bg-primary text-primary-foreground font-semibold px-5 py-3 shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all"
            >
              <Mail className="w-4 h-4" />
              hello@cairn.run
              <ArrowRight className="w-4 h-4 opacity-70 transition-transform group-hover:translate-x-0.5" />
            </a>
            <p className="mt-3 text-xs text-muted-foreground/80">{t.emailHint}</p>
          </div>

          {/* Self-host alternative — same content that used to own the hero
              CTA. Lives here now as an honest plan B for anyone who can't
              wait (and for the OSS crowd who was offended by the waitlist). */}
          <div className="mt-10 border-t border-border/60 pt-8">
            <p className="text-sm text-muted-foreground mb-4">{t.orLine}</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 font-mono text-xs text-foreground/80">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span>{t.selfHostCommand}</span>
              </div>
              <Link
                href={repo.base}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border hover:border-primary/40 px-3 py-2 text-xs text-foreground/80 hover:text-foreground transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                {t.githubCta}
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground/70">{t.selfHostNote}</p>
          </div>

          <div className="mt-12">
            <Link
              href={`/${typedLang}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t.back}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
