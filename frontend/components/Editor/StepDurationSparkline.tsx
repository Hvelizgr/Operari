'use client';

import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';

interface SparklineStats {
  runs: number;
  failureRate: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  recent: Array<{ status: string; startedAt: string; durationMs: number | null }>;
}

/**
 * Recharts sparkline showing the most recent N runs' durations for a
 * single step, with horizontal reference lines at p50 and p95. Used
 * inside the editor Inspector so the operator can see "is this step
 * usually fast and now slow, or has it always been slow?" without
 * leaving the canvas.
 *
 * Bars are colored by status (success / failure) so a red spike that
 * coincides with a duration jump tells the same story at a glance.
 *
 * Tiny footprint (~120px tall) so it fits inside the bottom-right
 * Inspector card without scrolling.
 */

interface StepDurationSparklineProps {
  stats: SparklineStats;
  /** Localized label for the tooltip header. */
  lang: 'en' | 'es';
}

export function StepDurationSparkline({ stats, lang }: StepDurationSparklineProps) {
  const recent = stats.recent.slice(0, 12).reverse();
  if (recent.length === 0) return null;

  const data = recent.map((entry, idx) => ({
    idx,
    duration: entry.durationMs ?? 0,
    status: entry.status,
    startedAt: entry.startedAt,
  }));

  const t =
    lang === 'es'
      ? { p50: 'p50', p95: 'p95', noRuns: 'Sin corridas recientes', ms: 'ms' }
      : { p50: 'p50', p95: 'p95', noRuns: 'No recent runs', ms: 'ms' };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span>
          {stats.runs} {lang === 'es' ? 'corridas' : 'runs'}
          {stats.failureRate != null && (
            <span className="ml-1 text-rose-400">
              · {(stats.failureRate * 100).toFixed(0)}% fail
            </span>
          )}
        </span>
        <span className="font-mono">
          {t.p50} {stats.p50DurationMs ?? '?'}
          {t.ms} · {t.p95} {stats.p95DurationMs ?? '?'}
          {t.ms}
        </span>
      </div>
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{
                background: '#0f1320',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                fontSize: 11,
                padding: '6px 8px',
              }}
              labelFormatter={() => ''}
              formatter={(value, _key, ctx) => {
                const status = (ctx?.payload as { status?: string } | undefined)?.status;
                return [`${value}ms · ${status ?? '—'}`, ''];
              }}
            />
            {stats.p50DurationMs != null && (
              <ReferenceLine
                y={stats.p50DurationMs}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="2 3"
              />
            )}
            {stats.p95DurationMs != null && (
              <ReferenceLine
                y={stats.p95DurationMs}
                stroke="rgba(255,255,255,0.4)"
                strokeDasharray="2 3"
              />
            )}
            <Bar
              dataKey="duration"
              fill="var(--rb-edge-success)"
              radius={[2, 2, 0, 0]}
              // Trigger.dev-flavoured grow-in: bars rise from the
              // baseline with an ease-out curve. 600ms total + 40ms
              // stagger per index reads as a quick wave instead of
              // a flat snap-on. Disabled in reduced-motion via the
              // `prefers-reduced-motion` media query that recharts
              // honours through its internal Animate wrapper.
              isAnimationActive
              animationDuration={600}
              animationEasing="ease-out"
              animationBegin={40}
              shape={props => {
                // Recharts passes the row's payload alongside the
                // computed pixel rect so we can color per-status
                // without precomputing two parallel series.
                const { x, y, width, height, payload } = props as unknown as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  payload: { status: 'SUCCESS' | 'FAILED' };
                };
                const fill =
                  payload.status === 'FAILED' ? 'var(--rb-edge-failed)' : 'var(--rb-edge-success)';
                return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
