import { ArrowUpRight, Workflow } from 'lucide-react';

type HowItWorksContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  open: string;
  frameTitle: string;
  note: string;
};

const DIAGRAM = '/diagrams/how-it-works.html';

/**
 * How it works — the run path drawn from the real code (Archify): every
 * box links to the source lines it stands for, pinned to a commit. The
 * diagram is a standalone page with its own pan/zoom and theme, so it is
 * framed rather than re-implemented here.
 */
export default function HowItWorks({ content }: { content: HowItWorksContent }) {
  return (
    <section className="bg-background relative py-24 sm:py-32">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col gap-6 sm:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="border-primary/30 bg-primary/10 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <Workflow className="h-3.5 w-3.5" />
              {content.eyebrow}
            </span>
            <h2 className="text-foreground text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              {content.title}
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
              {content.subtitle}
            </p>
          </div>
          <a
            href={DIAGRAM}
            target="_blank"
            rel="noopener"
            className="border-border bg-secondary/30 hover:bg-secondary/50 text-foreground inline-flex shrink-0 items-center gap-2 self-start rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors md:self-auto"
          >
            {content.open}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border">
          <iframe
            src={DIAGRAM}
            title={content.frameTitle}
            loading="lazy"
            className="block h-[560px] w-full sm:h-[840px]"
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs">{content.note}</p>
      </div>
    </section>
  );
}
