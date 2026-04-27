import { DNAHelixAnimation } from '@/components/Brand/DNAHelixAnimation';
import { DNAMark } from '@/components/Brand/DNAMark';

/**
 * Brand-preview scratch page.
 *
 * Mounts the DNA-helix mark + the animated hero variant at multiple
 * scales so the brand direction can be reviewed in the browser
 * before any of it lands on the actual marketing landing or in
 * email templates. Not linked from the sidebar — accessed directly
 * via /en/brand-preview or /es/brand-preview.
 */
export default async function BrandPreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  await params;
  return (
    <main className="min-h-screen bg-[#0a0f15] px-6 py-16 text-zinc-200">
      <div className="mx-auto max-w-5xl space-y-16">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Brand preview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            DNA helix — runbook steps tracing canvas + audit chain.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Two strands, three crossing nodes. Each strand is one of the two surfaces every step
            lives on at once: what you author (canvas) and what actually ran (audit chain). Steps
            are the dots — by definition connected to both.
          </p>
        </header>

        {/* Mark — multiple scales so we can see how it holds up from
            favicon (16px) to wordmark lockup (48px). */}
        <section>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Mark · scales
          </h2>
          <div className="flex flex-wrap items-end gap-10">
            {[16, 24, 32, 48, 64].map(size => (
              <div key={size} className="flex flex-col items-center gap-2">
                <DNAMark size={size} />
                <span className="font-mono text-[11px] text-zinc-500">{size}px</span>
              </div>
            ))}
          </div>
        </section>

        {/* Mark with rungs (alternate variant). Off by default — shown
            here for comparison. */}
        <section>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Mark · with rungs (variant)
          </h2>
          <div className="flex flex-wrap items-end gap-10">
            {[32, 48, 64].map(size => (
              <div key={size} className="flex flex-col items-center gap-2">
                <DNAMark size={size} showRungs />
                <span className="font-mono text-[11px] text-zinc-500">{size}px</span>
              </div>
            ))}
          </div>
        </section>

        {/* Wordmark lockup — what the sidebar header would show. */}
        <section>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Lockup · sidebar header
          </h2>
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-4 py-3">
              <DNAMark size={28} />
              <span className="text-lg font-bold tracking-tight text-white">Operari</span>
            </div>
            <div className="inline-flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
              <DNAMark size={20} />
              <span className="text-sm font-semibold tracking-tight text-white">Operari</span>
              <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                alpha
              </span>
            </div>
          </div>
        </section>

        {/* Animated hero. The full-size strand + travelling dots loop
            — this is what would replace / sit alongside the existing
            marketing hero scenario card. */}
        <section>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Hero animation · loop
          </h2>
          <div className="flex flex-wrap items-start gap-10">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border border-white/10 bg-[#0f1218] p-6">
                <DNAHelixAnimation width={200} height={480} />
              </div>
              <span className="font-mono text-[11px] text-zinc-500">200×480 · default</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border border-white/10 bg-[#0f1218] p-6">
                <DNAHelixAnimation width={140} height={340} />
              </div>
              <span className="font-mono text-[11px] text-zinc-500">140×340 · compact</span>
            </div>
            <div className="flex max-w-md flex-col gap-3 text-sm text-zinc-400">
              <p>
                Strands draw in over ~1.4s, then two dots travel along on a 4.5s loop. Each crossing
                reads as a step transition tracing both the canvas and the audit chain.
              </p>
              <p className="text-zinc-500">
                Reduced-motion: skips the draw + travel, renders fully visible strands. Same
                metaphor, no movement.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/5 pt-10">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Why this shape
          </h2>
          <ul className="grid grid-cols-1 gap-3 text-sm text-zinc-300 md:grid-cols-2">
            <li className="rounded-md border border-white/5 bg-white/[0.02] p-4">
              <strong className="block text-emerald-400">Two-strand metaphor.</strong>
              The visual carries the product story — a runbook lives on the canvas and in the audit
              chain at once. Single-strand logos would lose that.
            </li>
            <li className="rounded-md border border-white/5 bg-white/[0.02] p-4">
              <strong className="block text-emerald-400">Step crossings.</strong>
              Three nodes where the strands meet — top, middle, bottom — read naturally as
              &quot;this is a graph of steps&quot;, which is what a runbook is.
            </li>
            <li className="rounded-md border border-white/5 bg-white/[0.02] p-4">
              <strong className="block text-emerald-400">Animation latent.</strong>
              The same shape that renders flat at 16px favicons becomes a 4.5s loop at hero scale.
              One asset, two energies.
            </li>
            <li className="rounded-md border border-white/5 bg-white/[0.02] p-4">
              <strong className="block text-emerald-400">Devs-DNA cue.</strong>
              The &quot;this is in the dev&apos;s DNA&quot; line lands without saying biotech. The
              shape suggests structure, intrinsic, baked-in.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
