import { ArrowUpRight } from 'lucide-react';

/**
 * An Archify diagram from public/diagrams/. Each one is a standalone page
 * with its own pan/zoom, theme and source links, so it is framed rather
 * than re-implemented; the full-screen link is the escape hatch on phones.
 */
export default function DiagramEmbed({
  src,
  frameTitle,
  open,
  note,
  heightClass = 'h-[520px] sm:h-[720px]',
}: {
  src: string;
  frameTitle: string;
  open: string;
  note: string;
  heightClass?: string;
}) {
  return (
    <div>
      <div className="border-border/60 bg-card/40 overflow-hidden rounded-2xl border">
        <iframe
          src={src}
          title={frameTitle}
          loading="lazy"
          className={`block w-full ${heightClass}`}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{note}</p>
        <a
          href={src}
          target="_blank"
          rel="noopener"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
        >
          {open}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
