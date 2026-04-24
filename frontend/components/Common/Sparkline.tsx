/**
 * Inline run-status sparkline.
 *
 * Renders up to N tiny coloured tiles — one per recent run — so an
 * operator sees the recent health of a runbook without leaving the
 * current surface. Colour matches the status convention used on the
 * rest of the app (emerald = success, red = failed, sky = running,
 * amber = paused, zinc = cancelled, white/5 = empty slot).
 *
 * Empty slots are drawn with low-contrast tiles so the component
 * width is stable whatever the history depth — a runbook that ran
 * 3 times renders the same 20-slot strip as one that ran 300, with
 * the first 17 slots muted. This keeps cards and table rows aligned.
 */

interface SparklineProps {
  statuses: string[];
  /** Slot count. Defaults to 20. */
  slots?: number;
  /** Tile width in px. Default 4 for narrow table columns. */
  tileWidth?: number;
  /** Tile height in px. Default 16. */
  tileHeight?: number;
}

function color(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-500/80';
    case 'FAILED':
      return 'bg-red-500/80';
    case 'RUNNING':
      return 'bg-sky-500/80';
    case 'PAUSED':
      return 'bg-amber-500/80';
    case 'CANCELLED':
      return 'bg-zinc-500/60';
    default:
      return 'bg-white/5';
  }
}

export default function Sparkline({
  statuses,
  slots = 20,
  tileWidth = 4,
  tileHeight = 16,
}: SparklineProps) {
  const padded = [...Array(Math.max(0, slots - statuses.length)).fill('EMPTY'), ...statuses];
  const visible = padded.slice(-slots);
  return (
    <div className="flex items-center gap-[2px]" aria-hidden="true">
      {visible.map((s, i) => (
        <span
          key={i}
          className={`rounded-sm ${color(s)}`}
          style={{ width: tileWidth, height: tileHeight }}
          title={s !== 'EMPTY' ? s : undefined}
        />
      ))}
    </div>
  );
}
