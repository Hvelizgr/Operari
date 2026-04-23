'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Send } from 'lucide-react';
import { useState } from 'react';

import { repo } from '@/config/repo.config';

import type { content as contentEn } from '../../content/en';

type Contact = typeof contentEn.contact;

const CHANNEL_LABELS: Record<string, string> = {
  issues: 'open an issue',
  discussions: 'a discussion',
  'mailto:security@nanorun.dev': 'security@nanorun.dev',
  'mailto:hello@nanorun.dev': 'hello@nanorun.dev',
};

const CHANNEL_LABELS_ES: Record<string, string> = {
  issues: 'abrí un issue',
  discussions: 'una discusión',
  'mailto:security@nanorun.dev': 'security@nanorun.dev',
  'mailto:hello@nanorun.dev': 'hello@nanorun.dev',
};

const MAINTAINERS = [
  { initials: 'HV', name: 'Héctor', role: 'Founder' },
  { initials: 'AC', name: 'Agus', role: 'Engineer' },
  { initials: 'MR', name: 'Miguel', role: 'DX' },
];

function resolveHref(href: string) {
  if (href === 'issues') return repo.issues;
  if (href === 'discussions') return repo.discussions;
  return href;
}

/**
 * Contact — single-column "talk to a human" layout.
 *
 * Distinct from the rest of the marketing chrome:
 *   - serif headline (font-serif), not the geometric H1 used elsewhere
 *   - channels live as inline link chips inside a paragraph, not as a
 *     stack of cards (so the page reads as a *note*, not a directory)
 *   - the form is a single deck card, no traffic-light chrome, no split
 *   - send button uses a paper-plane icon that lifts off on hover
 */
export default function ContactView({ content, lang }: { content: Contact; lang: string }) {
  const labels = lang === 'es' ? CHANNEL_LABELS_ES : CHANNEL_LABELS;
  const channelByName = (frag: string) =>
    content.channels.find(c => c.href.includes(frag)) ?? content.channels[0];

  const issues = channelByName('issues');
  const discussions = channelByName('discussions');
  const security = channelByName('security@');
  const sales = channelByName('hello@');

  return (
    <main className="bg-background relative min-h-[88vh]">
      {/* Quiet warm vignette — subtle amber, breaks the emerald monoculture */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            'radial-gradient(ellipse 50% 70% at 50% -10%, rgba(245,158,11,0.05), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="container relative mx-auto max-w-2xl px-4 pb-24 pt-32 sm:px-6 sm:pb-32 sm:pt-40">
        {/* Headline — serif, big, friendly */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-foreground font-serif text-5xl leading-[1.02] tracking-[-0.02em] sm:text-6xl md:text-7xl"
        >
          {content.title}
        </motion.h1>

        {/* Inline-channel intro paragraph. Reads like a note. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="text-foreground/80 mt-6 font-serif text-lg leading-relaxed sm:text-xl"
        >
          {content.subtitle} {lang === 'es' ? 'Si tenés un' : 'If you have a'}{' '}
          <InlineChannel label={lang === 'es' ? 'bug' : 'bug'} href={resolveHref(issues.href)} />,{' '}
          {lang === 'es' ? 'tirános' : 'fire off'}{' '}
          <InlineChannel label={labels[issues.href] ?? 'issues'} href={resolveHref(issues.href)} />.{' '}
          {lang === 'es' ? '¿Pregunta abierta?' : 'Open question?'}{' '}
          <InlineChannel
            label={labels[discussions.href] ?? 'discussions'}
            href={resolveHref(discussions.href)}
          />
          . {lang === 'es' ? 'Vulnerabilidad' : 'Vulnerability'}{' '}
          <InlineChannel label={labels[security.href]} href={security.href} />.{' '}
          {lang === 'es' ? '¿Comercial?' : 'Commercial?'}{' '}
          <InlineChannel label={labels[sales.href]} href={sales.href} />.
        </motion.div>

        {/* Maintainer row — adds humanity, signals "real team", no stock photos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-10 flex items-center gap-3"
        >
          <div className="flex -space-x-2">
            {MAINTAINERS.map((m, i) => (
              <motion.div
                key={m.initials}
                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
                className="from-primary/30 border-background text-primary flex h-9 w-9 items-center justify-center rounded-full border-2 bg-gradient-to-br to-emerald-500/20 font-mono text-[10px] font-bold"
                title={`${m.name} · ${m.role}`}
              >
                {m.initials}
              </motion.div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {lang === 'es'
              ? 'Tres humanos. No hay ticket queue. Respondemos en 48h.'
              : 'Three humans. No ticket queue. Replies in 48h.'}
          </p>
        </motion.div>

        {/* Note card — looks like a torn-edge memo (clip-path + dashed underline), not a generic form panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative mt-14"
        >
          <p className="text-muted-foreground mb-3 font-mono text-[11px] uppercase tracking-[0.2em]">
            {lang === 'es' ? 'O dejá una nota' : 'Or leave a note'}
          </p>
          <ContactForm form={content.form} lang={lang} />
        </motion.div>
      </div>
    </main>
  );
}

function InlineChannel({ label, href }: { label: string; href: string }) {
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-primary border-primary/40 hover:border-primary/80 hover:text-primary/90 group inline-flex items-baseline gap-0.5 border-b border-dashed font-mono text-base transition-colors"
    >
      {label}
      <ArrowUpRight className="h-3 w-3 self-center opacity-50 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
    </a>
  );
}

function ContactForm({ form, lang }: { form: Contact['form']; lang: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setErrorMessage(null);

    const data = new FormData(e.currentTarget as HTMLFormElement);
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      company: String(data.get('company') ?? ''),
      message: String(data.get('message') ?? ''),
      website: String(data.get('website') ?? ''),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const issueMsg =
          Array.isArray(body?.issues) && body.issues[0]?.message
            ? String(body.issues[0].message)
            : lang === 'es'
              ? 'No pudimos enviar tu mensaje. Intenta de nuevo.'
              : 'We could not send your message. Try again.';
        setErrorMessage(issueMsg);
        setState('error');
        return;
      }
      setState('sent');
    } catch {
      setErrorMessage(
        lang === 'es'
          ? 'Sin conexión con el servidor. Probá de nuevo en un momento.'
          : 'Cannot reach the server. Try again in a moment.'
      );
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="border-primary/40 bg-primary/[0.04] rounded-2xl border p-8 text-center"
      >
        <div className="bg-primary/15 border-primary/40 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border">
          <Check className="text-primary h-5 w-5" />
        </div>
        <p className="text-foreground font-serif text-xl">{form.sent}</p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border/60 bg-card/40 relative space-y-5 rounded-2xl border p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label={form.name} name="name" required />
        <Field label={form.email} name="email" type="email" required />
      </div>
      <Field label={form.company} name="company" />
      <Field label={form.message} name="message" textarea rows={5} required />

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {state === 'error' && errorMessage && (
        <div
          role="alert"
          className="text-destructive bg-destructive/10 border-destructive/30 rounded-md border px-3 py-2 text-xs"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-1">
        <p className="text-muted-foreground text-[11px]">
          {lang === 'es'
            ? 'Tus datos no alimentan ningún CRM.'
            : 'Your data does not feed any CRM.'}
        </p>
        <button
          type="submit"
          disabled={state === 'sending'}
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 group inline-flex h-11 items-center gap-2 rounded-lg pl-5 pr-4 text-sm font-semibold shadow-md transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === 'sending' ? form.sending : form.submit}
          <Send className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-12" />
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  textarea,
  rows,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  rows?: number;
}) {
  const base =
    'peer w-full bg-transparent border-0 border-b border-border/60 px-0 py-2 text-base text-foreground placeholder-transparent focus:border-primary/70 focus:outline-none focus:ring-0 transition-colors';
  return (
    <label className="relative block pt-5">
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={rows ?? 4}
          placeholder={label}
          className={`${base} resize-none`}
        />
      ) : (
        <input type={type} name={name} required={required} placeholder={label} className={base} />
      )}
      <span className="text-muted-foreground peer-placeholder-shown:text-muted-foreground/60 peer-focus:text-primary pointer-events-none absolute left-0 top-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-all peer-placeholder-shown:top-7 peer-placeholder-shown:font-sans peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1 peer-focus:font-mono peer-focus:text-[10px] peer-focus:tracking-[0.18em]">
        {label}
      </span>
    </label>
  );
}
