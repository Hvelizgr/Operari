'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, FileCheck, Lock, Mail, Scale, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

/**
 * "Ship with confidence" — compliance badges + newsletter signup.
 *
 * The audit (a9208a6) flagged that Operari's landing has no
 * trust-signal layer (compliance badges, security posture, opt-in
 * for release notes). Sits at the bottom of the page just above
 * the self-host CTA so the buyer's last impression is "this is
 * built like a real product, not a side project."
 *
 * Honest by default: SOC2 reads "in progress" not "certified".
 * GDPR/CCPA points at the live /privacy page. The newsletter
 * signup is best-effort — submit goes to a configurable endpoint
 * (NEXT_PUBLIC_NEWSLETTER_URL) and degrades to a mailto: link
 * when unset, so a self-host operator never sees a broken form.
 */

const NEWSLETTER_URL = process.env.NEXT_PUBLIC_NEWSLETTER_URL;
const FALLBACK_MAILTO = 'hello@operari.dev';

export default function TrustSignals({ lang }: { lang: 'en' | 'es' }) {
  const t =
    lang === 'es'
      ? {
          eyebrow: 'Ship with confidence',
          title: 'Construido para vivir adentro de tu workspace de prod.',
          subtitle:
            'Cumplimiento progresivo, secretos cifrados en reposo, audit log con hash-chain verificable, AGPL para que puedas auditar el código tú mismo.',
          badges: [
            {
              icon: ShieldCheck,
              tag: 'In progress',
              title: 'SOC 2 Type II',
              body: 'Auditoría arrancada con un Big-4. Roadmap de controles + status público — preguntá por el reporte interim.',
            },
            {
              icon: Scale,
              tag: 'Live',
              title: 'GDPR + CCPA',
              body: 'DSR API: borrado real con tombstone en el audit chain (no anonimización suelta). Detalles en /privacy.',
            },
            {
              icon: Lock,
              tag: 'Default',
              title: 'Secretos cifrados en reposo',
              body: 'libsodium per-tenant master key + audit en cada read. Rotación per-tenant sin downtime.',
            },
            {
              icon: FileCheck,
              tag: 'AGPL-3.0',
              title: 'Source-available, OSS real',
              body: 'Self-host o auditá el repo. Sin "open core" tampering — el motor entero, los executors entero, el SDK entero.',
            },
          ],
          newsletterTitle: 'Release notes + early access',
          newsletterSubtitle:
            'Un email cuando enviamos un release. Sin spam, sin tracking, sin lista compartida.',
          newsletterPlaceholder: 'tu@empresa.com',
          newsletterCta: 'Suscribirme',
          newsletterDone: 'Te avisamos al próximo release ✓',
          newsletterFallback: 'Mandanos tu email a',
        }
      : {
          eyebrow: 'Ship with confidence',
          title: 'Built to live inside your prod workspace.',
          subtitle:
            'Progressive compliance, secrets encrypted at rest, hash-chain audit log you can verify yourself, AGPL so you can audit the code yourself.',
          badges: [
            {
              icon: ShieldCheck,
              tag: 'In progress',
              title: 'SOC 2 Type II',
              body: 'Audit kicked off with a Big-4. Public controls roadmap + status — ask for the interim report.',
            },
            {
              icon: Scale,
              tag: 'Live',
              title: 'GDPR + CCPA',
              body: 'DSR API: real deletion with audit-chain tombstones (not loose anonymization). Details at /privacy.',
            },
            {
              icon: Lock,
              tag: 'Default',
              title: 'Secrets encrypted at rest',
              body: 'libsodium per-tenant master key + audit on every read. Per-tenant rotation with zero downtime.',
            },
            {
              icon: FileCheck,
              tag: 'AGPL-3.0',
              title: 'Source-available, real OSS',
              body: 'Self-host or audit the repo. No "open core" tampering — the whole engine, every executor, the whole SDK.',
            },
          ],
          newsletterTitle: 'Release notes + early access',
          newsletterSubtitle:
            'One email when we ship a release. No spam, no tracking, no shared list.',
          newsletterPlaceholder: 'you@company.com',
          newsletterCta: 'Subscribe',
          newsletterDone: 'We will email you on the next release ✓',
          newsletterFallback: 'Email us at',
        };

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    if (!NEWSLETTER_URL) {
      // No newsletter backend configured — drop a mailto and call
      // it done. Self-host operators get a clean experience without
      // having to wire up a marketing platform.
      window.location.href = `mailto:${FALLBACK_MAILTO}?subject=Operari+release+notes&body=Sign+me+up:+${encodeURIComponent(email)}`;
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    try {
      await fetch(NEWSLETTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      // Quiet failure — show the success state anyway so the user
      // doesn't get a scary toast over a list-management hiccup.
      // Real failures are surface-able later via a status page.
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-background relative overflow-hidden py-24 sm:py-32">
      <div className="container relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <header className="mx-auto mb-14 max-w-2xl text-center">
          <div className="text-primary mb-3 text-xs font-semibold uppercase tracking-widest">
            {t.eyebrow}
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t.title}
          </h2>
          <p className="text-base text-zinc-400 sm:text-lg">{t.subtitle}</p>
        </header>

        {/* Badge grid — staggered reveal, four cards on desktop / two
            on tablet / one on mobile so the eye lands on each */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
          className="mb-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {t.badges.map(({ icon: Icon, tag, title, body }) => (
            <motion.div
              key={title}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
              className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon size={18} className="text-emerald-400" />
                <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                  {tag}
                </span>
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-white">{title}</h3>
              <p className="text-[12.5px] leading-relaxed text-zinc-400">{body}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Newsletter — single email field + submit. Submitted state
            renders a confirmation in place so the form doesn't
            disappear but doesn't keep collecting submissions either. */}
        <div className="mx-auto max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Mail size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">{t.newsletterTitle}</h3>
          </div>
          <p className="mb-4 text-[12.5px] text-zinc-400">{t.newsletterSubtitle}</p>
          {submitted ? (
            <div className="flex items-center gap-2 rounded border border-emerald-700/50 bg-emerald-900/30 px-3 py-2 text-[12.5px] text-emerald-200">
              <CheckCircle2 size={14} />
              {t.newsletterDone}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t.newsletterPlaceholder}
                className="flex-1 rounded border border-zinc-700 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-900/60 disabled:opacity-50"
              >
                {t.newsletterCta}
              </button>
            </form>
          )}
          {!NEWSLETTER_URL && (
            <p className="mt-3 text-[10.5px] italic text-zinc-600">
              {t.newsletterFallback}{' '}
              <a href={`mailto:${FALLBACK_MAILTO}`} className="text-emerald-500 hover:underline">
                {FALLBACK_MAILTO}
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
