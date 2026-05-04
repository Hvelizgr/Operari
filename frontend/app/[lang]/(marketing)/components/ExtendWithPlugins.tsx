'use client';

import { motion } from 'framer-motion';
import { Boxes, Package, RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * "Extend with plugins" — pitches the @operari/sdk + hot-reload story
 * that the audit flagged as a top-of-funnel gap. Sits between the
 * SafetyRails grid (which mentions plugins as one of six rails) and
 * the Templates gallery (which is YAML-only). The point is to show
 * a buyer that custom step types are first-class TypeScript: zod
 * schema validated, hot-reloaded in dev, sandbox-isolated in prod.
 *
 * Animation budget kept low on purpose — the section sits two scrolls
 * after a busy SafetyRails grid. Stagger reveal on the three feature
 * pills, no canvas / no terminal.
 */

const SNIPPET = `import { defineStep } from '@operari/sdk/steps';
import { z } from 'zod';

export default defineStep({
  type: 'myorg.slack-notify',
  configSchema: z.object({
    webhook: z.string().url(),
    message: z.string().min(1),
  }),
  async execute(config, context) {
    const res = await fetch(config.webhook, {
      method: 'POST',
      body: JSON.stringify({ text: config.message }),
    });
    return { success: res.ok, output: { status: res.status } };
  },
});`;

export default function ExtendWithPlugins({ lang }: { lang: 'en' | 'es' }) {
  const t =
    lang === 'es'
      ? {
          eyebrow: 'Extensible by default',
          title: 'Tus propios step types, en TypeScript, con hot-reload.',
          subtitle:
            'El SDK exporta defineStep({ type, configSchema, execute }). Lo ponés en OPERARI_PLUGINS_DIR y aparece como un step más en el editor — validado con zod antes de cada llamada, sandbox-aislado por tenant, recargado en caliente cuando guardás el archivo.',
          features: [
            {
              icon: Package,
              title: 'Un npm install, un defineStep',
              body: 'Sin handler boilerplate. El SDK le da al loader exactamente lo que espera; el runtime valida config con tu zod antes de invocar execute.',
            },
            {
              icon: RefreshCw,
              title: 'Hot-reload en dev, sin restart',
              body: 'Editás el archivo, fs.watch dispara, require.cache se invalida y el dispatcher consulta el registro live antes de su registro capturado. La call siguiente ya tiene los bytes nuevos.',
            },
            {
              icon: ShieldCheck,
              title: 'Aislamiento por tenant',
              body: 'Plugins globales viven en el dir raíz; los tenant-scoped en tenants/<id>/. El dispatcher refusa cross-tenant; tipos reservados (shell, approval, runbook…) no pueden sobreescribirse.',
            },
          ],
          captionStarter:
            'Starter completo en examples/plugins/slack-notify-starter — ts, zod, vitest, hot-reload listo.',
        }
      : {
          eyebrow: 'Extensible by default',
          title: 'Your own step types, in TypeScript, with hot-reload.',
          subtitle:
            'The SDK exports defineStep({ type, configSchema, execute }). Drop it in OPERARI_PLUGINS_DIR and it shows up as one more step in the editor — config validated with your zod before every call, sandbox-isolated per tenant, reloaded in place when you save the file.',
          features: [
            {
              icon: Package,
              title: 'One npm install, one defineStep',
              body: 'No handler boilerplate. The SDK gives the loader exactly what it expects; the runtime validates config against your zod before invoking execute.',
            },
            {
              icon: RefreshCw,
              title: 'Hot-reload in dev, no restart',
              body: 'Edit the file, fs.watch fires, require.cache invalidates, and the dispatcher consults the live registry before its captured one. The next call already has the new bytes.',
            },
            {
              icon: ShieldCheck,
              title: 'Per-tenant isolation',
              body: 'Global plugins live in the root dir; tenant-scoped under tenants/<id>/. The dispatcher refuses cross-tenant; reserved types (shell, approval, runbook…) cannot be overridden.',
            },
          ],
          captionStarter:
            'Full starter at examples/plugins/slack-notify-starter — ts, zod, vitest, hot-reload ready.',
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

        <div className="grid items-start gap-10 lg:grid-cols-5">
          {/* Code snippet — half the visual weight, anchors the section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-3"
          >
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-black/40 px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                  <Boxes size={12} />
                  src/steps/slack-notify.ts
                </div>
              </div>
              <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-6 text-zinc-200">
                {SNIPPET}
              </pre>
            </div>
            <p className="mt-3 text-center text-[11px] italic text-zinc-500">{t.captionStarter}</p>
          </motion.div>

          {/* Three feature pills — staggered reveal */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
            }}
            className="space-y-4 lg:col-span-2"
          >
            {t.features.map(({ icon: Icon, title, body }) => (
              <motion.div
                key={title}
                variants={{
                  hidden: { opacity: 0, x: 16 },
                  show: { opacity: 1, x: 0, transition: { duration: 0.4 } },
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon size={16} className="text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-400">{body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
