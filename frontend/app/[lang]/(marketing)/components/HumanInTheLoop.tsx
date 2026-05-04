'use client';

import { motion } from 'framer-motion';
import { Anchor, ArrowRight, CheckCircle2, Clock, Copy, UserCheck } from 'lucide-react';

/**
 * "Human in the loop" — pitches the unified Inbox (approvals +
 * waitpoints) plus the wait-token primitive. Both are post-product
 * surfaces that the marketing didn't yet name; the audit flagged
 * waitpoints as a real differentiator vs n8n's purely synchronous
 * model.
 *
 * Visual: two-column layout. Left = approval card mockup with a
 * grant button (the existing /inbox surface). Right = wait-token
 * card with the public URL + countdown (the new primitive). Both
 * read as a real screenshot of the Inbox without actually screenshotting
 * — divs are easier to keep in brand than an exported image that
 * goes stale every release.
 */

export default function HumanInTheLoop({ lang }: { lang: 'en' | 'es' }) {
  const t =
    lang === 'es'
      ? {
          eyebrow: 'Human-in-the-loop',
          title: 'Pause un run. Pasale el control a una persona, un vendor, o ambos.',
          subtitle:
            'Aprobaciones con grant/reject inline + tokens de espera con URL pública firmada. La misma Bandeja muestra los dos: el SRE de guardia ve qué espera decisión y qué espera callback en una sola lista.',
          approvalCard: {
            tag: 'PENDING',
            title: 'Approve canary deploy v3.4.2',
            requester: 'deploy.runbook · requested by ci-bot',
            grantLabel: 'Grant',
            rejectLabel: 'Reject',
            footer: 'Decisión auditada con hash-chain · run reanuda en ms',
          },
          waitpointCard: {
            tag: 'PENDING',
            id: 'wpt_a3f9c1d8',
            tags: ['stripe-callback', 'env:prod'],
            expires: 'Expira en 4m 12s',
            copyLabel: 'Copy URL',
            urlPreview: 'POST /api/waitpoints/wpt_…/complete',
            footer: 'Vendor hace POST → motor reanuda con el value como input',
          },
          bullets: [
            'Mismo TTL, misma lógica de timeout — si nadie responde, la rama timed_out toma el control.',
            'Auditoría parejas: cada grant / reject / complete escribe un evento hash-chain inmutable.',
            'Sin webhooks especiales — el id del token ES la URL. 128 bits de entropía, sin headers.',
          ],
        }
      : {
          eyebrow: 'Human-in-the-loop',
          title: 'Pause a run. Hand control to a person, a vendor, or both.',
          subtitle:
            'Inline grant/reject approvals + wait tokens with a signed public URL. The same Inbox surfaces both — the on-call SRE sees what is waiting on a decision and what is waiting on a callback in one list.',
          approvalCard: {
            tag: 'PENDING',
            title: 'Approve canary deploy v3.4.2',
            requester: 'deploy.runbook · requested by ci-bot',
            grantLabel: 'Grant',
            rejectLabel: 'Reject',
            footer: 'Decision audited with hash-chain · run resumes in ms',
          },
          waitpointCard: {
            tag: 'PENDING',
            id: 'wpt_a3f9c1d8',
            tags: ['stripe-callback', 'env:prod'],
            expires: 'Expires in 4m 12s',
            copyLabel: 'Copy URL',
            urlPreview: 'POST /api/waitpoints/wpt_…/complete',
            footer: 'Vendor POSTs the URL → engine resumes with the value as input',
          },
          bullets: [
            'Same TTL, same timeout logic — if no one responds, the timed_out branch takes over.',
            'Audit parity: every grant / reject / complete writes a hash-chained immutable event.',
            'No special webhooks — the token id IS the URL. 128 bits of entropy, zero headers.',
          ],
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

        {/* Two cards side by side: approval + wait token. Each is a
            faithful-but-stylised render of the actual /inbox row, so
            a buyer who later opens the product recognises it. */}
        <div className="mb-10 grid items-stretch gap-5 lg:grid-cols-2">
          {/* Approval card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-amber-900/40 bg-zinc-950/60 p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-2">
              <UserCheck size={16} className="text-amber-400" />
              <span className="rounded border border-amber-700/50 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                {t.approvalCard.tag}
              </span>
            </div>
            <div className="mb-1 text-sm font-semibold text-white">{t.approvalCard.title}</div>
            <div className="mb-4 font-mono text-[11px] text-zinc-500">
              {t.approvalCard.requester}
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded border border-emerald-700 bg-emerald-900/40 px-3 py-1 text-[11px] font-medium text-emerald-200">
                <CheckCircle2 size={12} />
                {t.approvalCard.grantLabel}
              </button>
              <button className="rounded border border-red-900/50 px-3 py-1 text-[11px] font-medium text-red-300">
                {t.approvalCard.rejectLabel}
              </button>
              <ArrowRight size={14} className="ml-auto text-zinc-700" aria-hidden="true" />
            </div>
            <p className="mt-4 border-t border-zinc-900 pt-3 text-[11px] italic text-zinc-500">
              {t.approvalCard.footer}
            </p>
          </motion.div>

          {/* Wait token card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-xl border border-violet-900/40 bg-zinc-950/60 p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-2">
              <Anchor size={16} className="text-violet-400" />
              <span className="rounded border border-violet-700/50 bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                {t.waitpointCard.tag}
              </span>
              <span className="font-mono text-[11px] text-zinc-300">{t.waitpointCard.id}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              {t.waitpointCard.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded bg-violet-900/30 px-1.5 py-0.5 text-[10px] text-violet-200"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mb-4 flex items-center gap-2 text-[11px]">
              <Clock size={12} className="text-amber-400" />
              <span className="text-amber-300">{t.waitpointCard.expires}</span>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <button className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-200">
                <Copy size={12} />
                {t.waitpointCard.copyLabel}
              </button>
              <code className="truncate font-mono text-[11px] text-zinc-500">
                {t.waitpointCard.urlPreview}
              </code>
            </div>
            <p className="mt-4 border-t border-zinc-900 pt-3 text-[11px] italic text-zinc-500">
              {t.waitpointCard.footer}
            </p>
          </motion.div>
        </div>

        {/* Three short bullets — the "why this matters" prose */}
        <ul className="mx-auto max-w-3xl space-y-2.5">
          {t.bullets.map(bullet => (
            <li
              key={bullet}
              className="flex items-start gap-3 text-sm leading-relaxed text-zinc-400"
            >
              <CheckCircle2
                size={14}
                className="mt-0.5 shrink-0 text-emerald-400"
                aria-hidden="true"
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
