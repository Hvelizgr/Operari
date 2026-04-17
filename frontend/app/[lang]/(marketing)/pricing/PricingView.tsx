'use client';

import { useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Minus, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { content as contentEn } from '../../content/en';

type Pricing = typeof contentEn.pricing;

export default function PricingView({ content, lang }: { content: Pricing; lang: string }) {
  const [yearly, setYearly] = useState(true);

  return (
    <main className="relative">
      {/* Top gradient stripe instead of full Aurora — gives this page a
          distinct "static marketing" feel vs the animated landing. */}
      <div
        className="absolute inset-x-0 top-0 h-[640px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 50% -30%, rgba(62,207,142,0.14), transparent 65%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(62,207,142,0.35), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative container mx-auto px-4 sm:px-6 max-w-6xl pt-28 pb-24 sm:pt-36 sm:pb-32">
        {/* HERO — tighter, no aurora; pill + H1 + subtitle + toggle */}
        <header className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-[11px] font-mono font-medium text-primary mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {content.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-5 leading-[1.05]">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {content.subtitle}
          </p>
        </header>

        <BillingToggle
          yearly={yearly}
          onChange={setYearly}
          yearlyLabel={content.billingYearly}
          monthlyLabel={content.billingMonthly}
        />

        {/* TIERS — 4-col with center-popular ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-20">
          {content.tiers.map((tier, i) => (
            <TierCard key={tier.id} tier={tier} yearly={yearly} lang={lang} popularLabel={content.popular} i={i} />
          ))}
        </div>

        {/* COMPARISON — distinct panel style: wider, no aurora, sticky header */}
        <Matrix content={content} />

        {/* FAQ — compact accordion + contact CTA below */}
        <FaqSection content={content.faq} />

        <BottomCta lang={lang} />
      </div>
    </main>
  );
}

function BillingToggle({
  yearly,
  onChange,
  yearlyLabel,
  monthlyLabel,
}: {
  yearly: boolean;
  onChange: (y: boolean) => void;
  yearlyLabel: string;
  monthlyLabel: string;
}) {
  return (
    <div className="flex justify-center mb-12">
      <div className="inline-flex items-center p-1 rounded-full bg-card/60 border border-border/70 backdrop-blur-md">
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            !yearly ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {monthlyLabel}
        </button>
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
            yearly ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {yearlyLabel}
        </button>
      </div>
    </div>
  );
}

function TierCard({
  tier,
  yearly,
  lang,
  popularLabel,
  i,
}: {
  tier: Pricing['tiers'][number];
  yearly: boolean;
  lang: string;
  popularLabel: string;
  i: number;
}) {
  const price = yearly ? tier.priceYearly : tier.price;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.4, delay: i * 0.06 }}
      className={`relative rounded-2xl border p-6 flex flex-col ${
        tier.highlighted
          ? 'border-primary/60 ring-1 ring-primary/40 bg-gradient-to-b from-primary/[0.08] to-card/60 shadow-xl shadow-primary/10'
          : 'border-border/60 bg-card/40'
      }`}
    >
      {tier.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          {popularLabel}
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground mb-1">{tier.name}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed min-h-[2.5rem] mb-5">
        {tier.description}
      </p>
      <div className="flex items-baseline gap-1 mb-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={price}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-4xl font-bold tracking-tight text-foreground"
          >
            {price}
          </motion.span>
        </AnimatePresence>
        {tier.period && (
          <span className="text-sm text-muted-foreground font-mono">{tier.period}</span>
        )}
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-foreground/85">
            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>
      <TierCta href={tier.ctaHref} label={tier.cta} highlighted={tier.highlighted} lang={lang} />
    </motion.div>
  );
}

function TierCta({
  href,
  label,
  highlighted,
  lang,
}: {
  href: string;
  label: string;
  highlighted: boolean;
  lang: string;
}) {
  const cls = `h-11 w-full rounded-lg font-semibold text-sm flex items-center justify-center transition-all ${
    highlighted
      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25'
      : 'bg-secondary/70 text-foreground border border-border hover:bg-secondary hover:border-primary/30'
  }`;
  if (href.startsWith('/') || href.startsWith('#')) {
    return (
      <Link href={`/${lang}${href}`} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={cls}>
      {label}
    </a>
  );
}

function Matrix({ content }: { content: Pricing }) {
  const tierNames = content.tiers.map((t) => t.name);
  return (
    <section className="mb-20 sm:mb-24">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-center mb-10">
        {content.comparison.title}
      </h2>
      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/60">
              <tr className="border-b border-border/60">
                <th className="text-left px-4 md:px-5 py-4 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground w-[40%]">
                  Feature
                </th>
                {tierNames.map((name, idx) => (
                  <th
                    key={name}
                    className={`text-center px-3 md:px-4 py-4 text-[11px] uppercase tracking-wider font-semibold ${
                      idx === 1 ? 'text-primary bg-primary/[0.06]' : 'text-foreground/90'
                    }`}
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.comparison.groups.map((group) => (
                <Fragment key={group.name}>
                  <tr className="border-b border-border/40 bg-primary/[0.03]">
                    <td
                      colSpan={tierNames.length + 1}
                      className="px-4 md:px-5 py-2 text-[10px] uppercase tracking-[0.15em] font-bold text-primary/90"
                    >
                      {group.name}
                    </td>
                  </tr>
                  {group.rows.map((row, ri) => (
                    <tr
                      key={`${group.name}-${row.feature}`}
                      className={`border-b border-border/25 last:border-0 ${ri % 2 === 0 ? 'bg-background/[0.02]' : ''}`}
                    >
                      <td className="px-4 md:px-5 py-3 text-foreground/90 font-medium">{row.feature}</td>
                      {row.values.map((v, idx) => (
                        <td
                          key={idx}
                          className={`px-3 md:px-4 py-3 text-center ${idx === 1 ? 'bg-primary/[0.05]' : ''}`}
                        >
                          <MatrixCell value={v} highlighted={idx === 1} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MatrixCell({ value, highlighted }: { value: string; highlighted: boolean }) {
  const v = value.toLowerCase();
  if (v === 'yes' || v === 'sí') {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/15 border border-primary/40">
        <Check className="w-3.5 h-3.5 text-primary" />
      </span>
    );
  }
  if (v === 'no') {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-destructive/10 border border-destructive/30">
        <X className="w-3.5 h-3.5 text-destructive" />
      </span>
    );
  }
  if (v === '—') {
    return <Minus className="inline w-3.5 h-3.5 text-muted-foreground" />;
  }
  return (
    <span className={`font-mono text-xs ${highlighted ? 'text-foreground/95' : 'text-muted-foreground'}`}>
      {value}
    </span>
  );
}

function FaqSection({ content }: { content: Pricing['faq'] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mb-16">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-center mb-10">
        {content.title}
      </h2>
      <div className="max-w-3xl mx-auto space-y-3">
        {content.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card/40 overflow-hidden"
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-background/30 transition-colors"
              >
                <span className="font-semibold text-foreground text-sm sm:text-base">{item.q}</span>
                <Plus
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-45 text-primary' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BottomCta({ lang }: { lang: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
      className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card/60 to-card/20 p-8 sm:p-10 text-center overflow-hidden"
    >
      <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
        {lang === 'es' ? '¿Más preguntas?' : 'Still have questions?'}
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-6">
        {lang === 'es'
          ? 'Hablamos directo con el equipo que está construyendo esto. Sin SDR, sin BDR.'
          : 'Talk directly with the team building this. No SDR, no BDR.'}
      </p>
      <Link
        href={`/${lang}/contact`}
        className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-md shadow-primary/25"
      >
        {lang === 'es' ? 'Hablar con nosotros' : 'Talk to us'}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.div>
  );
}
