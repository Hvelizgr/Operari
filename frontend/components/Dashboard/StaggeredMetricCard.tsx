import anime from 'animejs';
import { useEffect, useRef } from 'react';

interface StaggeredMetricCardProps {
  label: string;
  value: number;
  suffix?: string;
  subValue?: string;
  icon?: React.ReactNode;
  delay?: number;
}

export function StaggeredMetricCard({
  label,
  value,
  suffix = '',
  subValue,
  icon,
  delay = 0,
}: StaggeredMetricCardProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Entrance animation for the card
    anime({
      targets: cardRef.current,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 800,
      delay: delay,
      easing: 'cubicBezier(0.22, 1, 0.36, 1)',
    });

    // 2. Counting animation for the value
    const obj = { val: 0 };
    anime({
      targets: obj,
      val: value,
      round: 1,
      easing: 'easeOutExpo',
      duration: 2000,
      delay: delay + 200,
      update: () => {
        if (valueRef.current) {
          valueRef.current.innerHTML = obj.val.toLocaleString();
        }
      },
    });
  }, [value, delay]);

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-sm transition-all hover:shadow-md"
    >
      <div className="absolute -right-4 -top-4 opacity-[0.03] grayscale transition-all group-hover:scale-110">
        {icon}
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-[var(--accent-color)]/10 rounded-lg p-2 text-[var(--accent-color)]">
          {icon}
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          ref={valueRef}
          className="text-4xl font-black tracking-tighter text-[var(--text-primary)]"
        >
          0
        </span>
        <span className="text-sm font-semibold text-[var(--text-muted)]">{suffix}</span>
      </div>

      {subValue && <div className="mt-2 text-xs font-medium text-[var(--op-moss)]">{subValue}</div>}
    </div>
  );
}
