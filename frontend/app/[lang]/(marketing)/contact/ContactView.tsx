'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, MessageCircle, Bug, Lock, Briefcase, ArrowUpRight } from 'lucide-react';
import { repo } from '@/config/repo.config';
import type { content as contentEn } from '../../content/en';

type Contact = typeof contentEn.contact;

const CHANNEL_ICONS: Record<string, typeof Bug> = {
  issues: Bug,
  discussions: MessageCircle,
  'mailto:security@nanorun.dev': Lock,
  'mailto:hello@nanorun.dev': Briefcase,
};

function resolveHref(href: string) {
  if (href === 'issues') return repo.issues;
  if (href === 'discussions') return repo.discussions;
  return href;
}

export default function ContactView({ content, lang }: { content: Contact; lang: string }) {
  return (
    <main className="relative bg-background">
      {/* Single center-top highlight spot — no aurora orbs. Feels "quiet",
          which matches the intent of a contact page. */}
      <div
        className="absolute inset-x-0 top-0 h-[400px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 40% 80% at 50% 0%, rgba(62,207,142,0.08), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-4 sm:px-6 max-w-6xl pt-28 pb-24 sm:pt-36 sm:pb-32">
        {/* Tight, centered heading */}
        <header className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-4 leading-[1.05]">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">{content.subtitle}</p>
        </header>

        {/* Split layout — channels left, form right. Minimal chrome. */}
        <div className="grid lg:grid-cols-[1fr,1.2fr] gap-10 lg:gap-16 items-start">
          {/* LEFT — channel stack */}
          <div className="space-y-3">
            {content.channels.map((ch, i) => {
              const href = resolveHref(ch.href);
              const Icon = CHANNEL_ICONS[ch.href] ?? MessageCircle;
              return (
                <motion.a
                  key={ch.name}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="group flex items-start gap-4 p-5 rounded-xl border border-border/60 bg-card/30 hover:bg-card/60 hover:border-primary/40 transition-all"
                >
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base">
                        {ch.name}
                      </h3>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      {ch.description}
                    </p>
                    <span className="font-mono text-[11px] text-primary/90 break-all">
                      {ch.action}
                    </span>
                  </div>
                </motion.a>
              );
            })}

            {/* Office card — signals "real company", helps SEO, fills vertical space */}
            <div className="p-5 rounded-xl border border-dashed border-border/60 bg-card/20">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                {lang === 'es' ? 'Dónde estamos' : 'Where we are'}
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {lang === 'es'
                  ? 'Distribuidos globalmente. Horarios en husos UTC±3 y UTC−3. Respondemos en 48h o menos.'
                  : 'Globally distributed. Coverage across UTC±3 and UTC−3 timezones. Replies within 48h or less.'}
              </p>
            </div>
          </div>

          {/* RIGHT — form card */}
          <ContactForm form={content.form} lang={lang} />
        </div>
      </div>
    </main>
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
      // Honeypot field — invisible to real users, bots fill everything.
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
          : 'Cannot reach the server. Try again in a moment.',
      );
      setState('error');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8"
    >
      {/* Mock "form chrome" — traffic-light dots match the rest of the landing mockups */}
      <div className="flex items-center gap-1.5 mb-6 pb-4 border-b border-border/40">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">{form.title}</span>
      </div>

      {state === 'sent' ? (
        <div className="flex items-center gap-3 py-12 justify-center text-foreground">
          <span className="h-8 w-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
            <Check className="w-4 h-4 text-primary" />
          </span>
          <span className="text-base">{form.sent}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={form.name} name="name" required />
            <Field label={form.email} name="email" type="email" required />
          </div>
          <Field label={form.company} name="company" />
          <Field label={form.message} name="message" textarea rows={5} required />

          {/* Honeypot — invisible to humans, crawlers fill every field. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] w-0 h-0 opacity-0 pointer-events-none"
          />

          {state === 'error' && errorMessage && (
            <div
              role="alert"
              className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={state === 'sending'}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {state === 'sending' ? form.sending : form.submit}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {lang === 'es'
              ? 'Tus datos no alimentan ningún CRM.'
              : 'Your data does not feed any CRM.'}
          </p>
        </form>
      )}
    </motion.div>
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
    'w-full rounded-lg bg-background/60 border border-border/70 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors';
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </span>
      {textarea ? (
        <textarea name={name} required={required} rows={rows ?? 4} className={`${base} resize-none`} />
      ) : (
        <input type={type} name={name} required={required} className={base} />
      )}
    </label>
  );
}
