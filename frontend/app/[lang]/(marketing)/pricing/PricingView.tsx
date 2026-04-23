'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { Check, X, Minus, Plus, ArrowRight, Loader2, Sparkles, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import type { content as contentEn } from '../../content/en';
import { useAuth } from '@/lib/auth';

type Pricing = typeof contentEn.pricing;

type CalcCopy = {
  calcEyebrow: string;
  calcTitle: string;
  calcSubtitle: string;
  seats: string;
  runs: string;
  pickedFor: string;
  customQuote: string;
  perMonth: string;
  yearlyHint: string;
  monthlyHint: string;
  runsHint: string;
};

const COPY: { en: CalcCopy; es: CalcCopy } = {
  en: {
    calcEyebrow: 'Cost calculator',
    calcTitle: 'Drag the slider. See what you would pay.',
    calcSubtitle:
      'Self-host stays free at any scale. The number on the right is what each Cloud tier would charge for the team you set below.',
    seats: 'Seats',
    runs: 'Runs / month',
    pickedFor: 'Recommended for this team',
    customQuote: "Let's talk",
    perMonth: '/mo',
    yearlyHint: '(billed yearly)',
    monthlyHint: '(billed monthly)',
    runsHint: 'Hosted ingest only — self-host has no cap.',
  },
  es: {
    calcEyebrow: 'Calculadora de costo',
    calcTitle: 'Movés el slider. Ves qué pagarías.',
    calcSubtitle:
      'Self-host sigue gratis a cualquier escala. El número de la derecha es lo que cobraría cada tier Cloud para el equipo que configures abajo.',
    seats: 'Asientos',
    runs: 'Runs / mes',
    pickedFor: 'Recomendado para este equipo',
    customQuote: 'Hablemos',
    perMonth: '/mes',
    yearlyHint: '(facturación anual)',
    monthlyHint: '(facturación mensual)',
    runsHint: 'Solo hosted ingest — self-host no tiene tope.',
  },
};

type Tier = Pricing['tiers'][number];

/**
 * Pricing — opens with an interactive cost calculator hero.
 *
 * The slider drives `seats` (1..50) which:
 *   1. Recomputes each tier's monthly total using a framer-motion spring,
 *      so the number ticks rather than snapping.
 *   2. Picks a recommended tier (self-host ≤2, team ≤15, business ≤40,
 *      enterprise after) and pulses a glow on the matching TierCard.
 *
 * Below the calculator we keep the original 4-column grid + matrix +
 * FAQ. The billing checkout wiring (UpgradeCta) is unchanged so the
 * Stripe flow keeps working.
 */
export default function PricingView({ content, lang }: { content: Pricing; lang: string }) {
  const [yearly, setYearly] = useState(true);
  const [seats, setSeats] = useState(8);

  const recommendedId = recommendTier(seats);

  const copy = lang === 'es' ? COPY.es : COPY.en;

  return (
    <main className="relative">
      {/* Hero band — dotted-grid backdrop. Anchors the calculator visually
          and contrasts with the matrix section below it (flat dark). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[860px] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(62,207,142,0.45) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 75%)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="container relative mx-auto max-w-6xl px-4 pb-24 pt-28 sm:px-6 sm:pb-32 sm:pt-32">
        <CalculatorHero
          copy={copy}
          content={content}
          seats={seats}
          setSeats={setSeats}
          yearly={yearly}
          onToggleYearly={setYearly}
          recommendedId={recommendedId}
        />

        {/* TIERS — 4-col with center-popular ribbon. Now also reactive to
            the seats slider (each card shows its computed monthly total). */}
        <div className="mb-20 mt-14 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
          {content.tiers.map((tier, i) => (
            <TierCard
              key={tier.id}
              tier={tier}
              yearly={yearly}
              lang={lang}
              popularLabel={content.popular}
              i={i}
              seats={seats}
              recommended={recommendedId === tier.id}
              recommendedLabel={copy.pickedFor}
            />
          ))}
        </div>

        <Matrix content={content} />

        <FaqSection content={content.faq} />

        <BottomCta lang={lang} />
      </div>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────
 *  Calculator hero
 * ────────────────────────────────────────────────────────────────── */

function CalculatorHero({
  copy,
  content,
  seats,
  setSeats,
  yearly,
  onToggleYearly,
  recommendedId,
}: {
  copy: CalcCopy;
  content: Pricing;
  seats: number;
  setSeats: (n: number) => void;
  yearly: boolean;
  onToggleYearly: (y: boolean) => void;
  recommendedId: string;
}) {
  const recommended = content.tiers.find(t => t.id === recommendedId)!;
  const total = computeMonthlyTotal(recommended, seats, yearly);

  return (
    <section className="grid items-start gap-10 lg:grid-cols-[1.1fr,1fr] lg:gap-14">
      {/* LEFT — title + slider deck */}
      <div>
        <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider">
          <Sparkles className="h-3 w-3" />
          {copy.calcEyebrow}
        </span>
        <h1 className="text-foreground mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl md:text-6xl">
          {copy.calcTitle}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          {copy.calcSubtitle}
        </p>

        <div className="mt-10 flex items-center gap-3">
          <BillingToggle
            yearly={yearly}
            onChange={onToggleYearly}
            yearlyLabel={content.billingYearly}
            monthlyLabel={content.billingMonthly}
          />
        </div>

        <div className="mt-10 space-y-7">
          <SeatsSlider value={seats} onChange={setSeats} label={copy.seats} tiers={content.tiers} />
        </div>
      </div>

      {/* RIGHT — live total card */}
      <TotalCard
        copy={copy}
        recommended={recommended}
        seats={seats}
        yearly={yearly}
        totalUsd={total === 'custom' ? null : total}
        customLabel={copy.customQuote}
      />
    </section>
  );
}

function TotalCard({
  copy,
  recommended,
  seats,
  yearly,
  totalUsd,
  customLabel,
}: {
  copy: CalcCopy;
  recommended: Tier;
  seats: number;
  yearly: boolean;
  totalUsd: number | null;
  customLabel: string;
}) {
  const isCustom = totalUsd === null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      className="relative"
    >
      {/* Halo glow — pulses softly when recommendation changes */}
      <motion.div
        key={recommended.id}
        initial={{ opacity: 0.6, scale: 0.92 }}
        animate={{ opacity: 0.45, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="from-primary/25 absolute -inset-6 rounded-3xl bg-gradient-to-br via-emerald-500/10 to-transparent blur-2xl"
        aria-hidden="true"
      />
      <div className="border-primary/40 bg-card/80 relative rounded-3xl border p-7 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
        <div className="text-primary mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
          <Zap className="h-3.5 w-3.5" />
          {copy.pickedFor}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={recommended.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="text-foreground text-3xl font-bold leading-tight sm:text-4xl">
              {recommended.name}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {recommended.description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="border-border/60 mt-7 border-t pt-6">
          <div className="flex items-baseline gap-2">
            {isCustom ? (
              <span className="text-foreground text-5xl font-bold tracking-tight sm:text-6xl">
                {customLabel}
              </span>
            ) : (
              <>
                <TickerNumber value={totalUsd} />
                <span className="text-muted-foreground font-mono text-sm">{copy.perMonth}</span>
              </>
            )}
          </div>
          {!isCustom && (
            <p className="text-muted-foreground/80 mt-2 font-mono text-[11px]">
              {seats} × {yearly ? recommended.priceYearly : recommended.price}
              {recommended.period ? ' ' + recommended.period : ''}{' '}
              {yearly ? copy.yearlyHint : copy.monthlyHint}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Number ticker — uses framer-motion's spring so the displayed integer
 * eases between targets instead of snapping. `value` of null renders the
 * "Let's talk" custom label as plain text.
 */
function TickerNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const spring = useSpring(0, { stiffness: 90, damping: 16, mass: 0.5 });
  const display = useTransform(spring, latest => `$${Math.round(latest).toLocaleString('en-US')}`);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce) spring.jump(value);
    else spring.set(value);
  }, [value, spring, reduce]);

  useEffect(() => {
    return display.on('change', latest => {
      if (ref.current) ref.current.textContent = latest;
    });
  }, [display]);

  return (
    <span
      ref={ref}
      className="text-foreground text-5xl font-bold tabular-nums tracking-tight sm:text-6xl"
    >
      $0
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────
 *  Seat slider
 * ────────────────────────────────────────────────────────────────── */

const SEAT_MARKS = [1, 5, 15, 40, 80];

function SeatsSlider({
  value,
  onChange,
  label,
  tiers,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  tiers: Tier[];
}) {
  const min = 1;
  const max = 80;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
          <Users className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="text-foreground font-mono text-2xl font-bold tabular-nums">
          {value}
          {value === max ? '+' : ''}
        </div>
      </div>

      <div className="relative h-10">
        {/* Track */}
        <div className="bg-card/80 border-border/60 absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full border">
          <div
            className="from-primary h-full bg-gradient-to-r to-emerald-400"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Tier band markers — drawn underneath as faint chips so the
            user has a sense of where each tier "kicks in" */}
        <div className="pointer-events-none absolute inset-0 flex">
          {tiers.map((t, i) => {
            const start = (i / tiers.length) * 100;
            const widthPct = (1 / tiers.length) * 100;
            return (
              <div
                key={t.id}
                className="border-border/40 text-muted-foreground/50 border-l pl-1 pt-0.5 font-mono text-[9px] first:border-l-0"
                style={{ width: `${widthPct}%`, marginLeft: i === 0 ? `${start}%` : 0 }}
              >
                {t.name}
              </div>
            );
          })}
        </div>

        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />

        {/* Custom thumb */}
        <div
          className="bg-primary border-background shadow-primary/40 pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="text-muted-foreground/70 mt-3 flex justify-between font-mono text-[10px]">
        {SEAT_MARKS.map(m => (
          <span key={m}>{m === max ? `${m}+` : m}</span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 *  Helpers
 * ────────────────────────────────────────────────────────────────── */

function recommendTier(seats: number): string {
  if (seats <= 2) return 'self-host';
  if (seats <= 15) return 'team';
  if (seats <= 40) return 'business';
  return 'enterprise';
}

/**
 * Pull the integer dollar amount out of a price string like "$19" or
 * "$0". Returns 'custom' for the Enterprise tier so the caller can
 * render a non-numeric label.
 */
function computeMonthlyTotal(tier: Tier, seats: number, yearly: boolean): number | 'custom' {
  const raw = yearly ? tier.priceYearly : tier.price;
  if (/custom/i.test(raw)) return 'custom';
  const m = raw.match(/(\d+)/);
  if (!m) return 0;
  const unit = parseInt(m[1], 10);
  if (tier.period && /user/i.test(tier.period)) return unit * seats;
  return unit;
}

/* ──────────────────────────────────────────────────────────────────
 *  Original tier grid (preserved, with seats-aware total)
 * ────────────────────────────────────────────────────────────────── */

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
    <div className="bg-card/60 border-border/70 inline-flex items-center rounded-full border p-1 backdrop-blur-md">
      <button
        onClick={() => onChange(false)}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
          !yearly
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {monthlyLabel}
      </button>
      <button
        onClick={() => onChange(true)}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
          yearly
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {yearlyLabel}
      </button>
    </div>
  );
}

function TierCard({
  tier,
  yearly,
  lang,
  popularLabel,
  i,
  seats,
  recommended,
  recommendedLabel,
}: {
  tier: Tier;
  yearly: boolean;
  lang: string;
  popularLabel: string;
  i: number;
  seats: number;
  recommended: boolean;
  recommendedLabel: string;
}) {
  const price = yearly ? tier.priceYearly : tier.price;
  const total = computeMonthlyTotal(tier, seats, yearly);
  const showTotal = seats > 1 && total !== 'custom' && tier.period && /user/i.test(tier.period);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.4, delay: i * 0.06 }}
      animate={
        recommended
          ? { boxShadow: '0 0 0 1px rgba(62,207,142,0.6), 0 20px 50px -10px rgba(62,207,142,0.25)' }
          : { boxShadow: '0 0 0 0px rgba(62,207,142,0)' }
      }
      className={`relative flex flex-col rounded-2xl border p-6 ${
        tier.highlighted
          ? 'border-primary/60 from-primary/[0.08] to-card/60 bg-gradient-to-b'
          : 'border-border/60 bg-card/40'
      } ${recommended ? 'border-primary/80' : ''}`}
    >
      {tier.highlighted && (
        <div className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          {popularLabel}
        </div>
      )}
      {recommended && !tier.highlighted && (
        <div className="border-primary/60 text-primary absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          {recommendedLabel}
        </div>
      )}
      <h3 className="text-foreground mb-1 text-lg font-bold">{tier.name}</h3>
      <p className="text-muted-foreground mb-5 min-h-[2.5rem] text-xs leading-relaxed">
        {tier.description}
      </p>
      <div className="mb-2 flex items-baseline gap-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={price}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-foreground text-4xl font-bold tracking-tight"
          >
            {price}
          </motion.span>
        </AnimatePresence>
        {tier.period && (
          <span className="text-muted-foreground font-mono text-sm">{tier.period}</span>
        )}
      </div>
      {showTotal ? (
        <p className="text-primary/90 mb-4 font-mono text-[11px]">
          {seats} {/team/i.test(tier.id) || /business/i.test(tier.id) ? 'seats' : ''} = $
          {(total as number).toLocaleString('en-US')}/mo
        </p>
      ) : (
        <div className="mb-4 h-[14px]" />
      )}

      <ul className="mb-6 flex-1 space-y-2.5">
        {tier.features.map(f => (
          <li key={f} className="text-foreground/85 flex items-start gap-2 text-sm">
            <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>
      <TierCta
        tierId={tier.id}
        href={tier.ctaHref}
        label={tier.cta}
        highlighted={tier.highlighted}
        lang={lang}
        yearly={yearly}
      />
    </motion.div>
  );
}

const PAID_PLAN_ID: Record<string, 'TEAM' | 'BUSINESS'> = {
  team: 'TEAM',
  business: 'BUSINESS',
};

function TierCta({
  tierId,
  href,
  label,
  highlighted,
  lang,
  yearly,
}: {
  tierId: string;
  href: string;
  label: string;
  highlighted: boolean;
  lang: string;
  yearly: boolean;
}) {
  const cls = `h-11 w-full rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
    highlighted
      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25'
      : 'bg-secondary/70 text-foreground border border-border hover:bg-secondary hover:border-primary/30'
  }`;
  const plan = PAID_PLAN_ID[tierId];
  if (plan) {
    return (
      <UpgradeCta plan={plan} label={label} cls={cls} lang={lang} yearly={yearly} tierId={tierId} />
    );
  }
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

function UpgradeCta({
  plan,
  label,
  cls,
  lang,
  yearly,
  tierId,
}: {
  plan: 'TEAM' | 'BUSINESS';
  label: string;
  cls: string;
  lang: string;
  yearly: boolean;
  tierId: string;
}) {
  const { session, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <button disabled className={`${cls} cursor-not-allowed opacity-60`}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (!session || session.user.id === 'anonymous') {
    return (
      <Link href={`/${lang}/register?plan=${encodeURIComponent(tierId)}`} className={cls}>
        {label}
      </Link>
    );
  }

  async function onClick() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, period: yearly ? 'yearly' : 'monthly' }),
      });
      if (res.status === 501) {
        window.location.href = `/${lang}/contact`;
        return;
      }
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
      const body = (await res.json()) as { url: string };
      window.location.href = body.url;
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <button onClick={onClick} disabled={submitting} className={cls}>
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </button>
  );
}

function Matrix({ content }: { content: Pricing }) {
  const tierNames = content.tiers.map(t => t.name);
  return (
    <section className="mb-20 sm:mb-24">
      <h2 className="text-foreground mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
        {content.comparison.title}
      </h2>
      <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/60">
              <tr className="border-border/60 border-b">
                <th className="text-muted-foreground w-[40%] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wider md:px-5">
                  Feature
                </th>
                {tierNames.map((name, idx) => (
                  <th
                    key={name}
                    className={`px-3 py-4 text-center text-[11px] font-semibold uppercase tracking-wider md:px-4 ${
                      idx === 1 ? 'text-primary bg-primary/[0.06]' : 'text-foreground/90'
                    }`}
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.comparison.groups.map(group => (
                <Fragment key={group.name}>
                  <tr className="border-border/40 bg-primary/[0.03] border-b">
                    <td
                      colSpan={tierNames.length + 1}
                      className="text-primary/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] md:px-5"
                    >
                      {group.name}
                    </td>
                  </tr>
                  {group.rows.map((row, ri) => (
                    <tr
                      key={`${group.name}-${row.feature}`}
                      className={`border-border/25 border-b last:border-0 ${ri % 2 === 0 ? 'bg-background/[0.02]' : ''}`}
                    >
                      <td className="text-foreground/90 px-4 py-3 font-medium md:px-5">
                        {row.feature}
                      </td>
                      {row.values.map((v, idx) => (
                        <td
                          key={idx}
                          className={`px-3 py-3 text-center md:px-4 ${idx === 1 ? 'bg-primary/[0.05]' : ''}`}
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
      <span className="bg-primary/15 border-primary/40 inline-flex h-6 w-6 items-center justify-center rounded-full border">
        <Check className="text-primary h-3.5 w-3.5" />
      </span>
    );
  }
  if (v === 'no') {
    return (
      <span className="bg-destructive/10 border-destructive/30 inline-flex h-6 w-6 items-center justify-center rounded-full border">
        <X className="text-destructive h-3.5 w-3.5" />
      </span>
    );
  }
  if (v === '—') {
    return <Minus className="text-muted-foreground inline h-3.5 w-3.5" />;
  }
  return (
    <span
      className={`font-mono text-xs ${highlighted ? 'text-foreground/95' : 'text-muted-foreground'}`}
    >
      {value}
    </span>
  );
}

function FaqSection({ content }: { content: Pricing['faq'] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mb-16">
      <h2 className="text-foreground mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
        {content.title}
      </h2>
      <div className="mx-auto max-w-3xl space-y-3">
        {content.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="border-border/60 bg-card/40 overflow-hidden rounded-xl border">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="hover:bg-background/30 flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
              >
                <span className="text-foreground text-sm font-semibold sm:text-base">{item.q}</span>
                <Plus
                  className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${isOpen ? 'text-primary rotate-45' : ''}`}
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
                    <div className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed">
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
      className="border-primary/30 from-primary/[0.08] via-card/60 to-card/20 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-8 text-center sm:p-10"
    >
      <h3 className="text-foreground mb-3 text-2xl font-bold sm:text-3xl">
        {lang === 'es' ? '¿Más preguntas?' : 'Still have questions?'}
      </h3>
      <p className="text-muted-foreground mx-auto mb-6 max-w-xl text-sm sm:text-base">
        {lang === 'es'
          ? 'Hablamos directo con el equipo que está construyendo esto. Sin SDR, sin BDR.'
          : 'Talk directly with the team building this. No SDR, no BDR.'}
      </p>
      <Link
        href={`/${lang}/contact`}
        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25 inline-flex h-11 items-center gap-2 rounded-lg px-6 text-sm font-semibold shadow-md"
      >
        {lang === 'es' ? 'Hablar con nosotros' : 'Talk to us'}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}
