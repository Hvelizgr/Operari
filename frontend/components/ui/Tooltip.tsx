'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

/**
 * Thin, opinionated wrapper around `@radix-ui/react-tooltip` that
 * keeps call sites tight:
 *
 *     <HoverTooltip label="Run from here">
 *       <button onClick={runHere}><Play size={14} /></button>
 *     </HoverTooltip>
 *
 * Why a wrapper instead of using the primitives directly: every site
 * we care about is a single trigger + a single string label, with the
 * same dark-themed bubble and the same delay timings. Eliminating the
 * 5 lines of Trigger/Content/Portal scaffolding per call keeps the
 * editor's chrome readable and gives us a single place to retune the
 * visuals (e.g. swap to a Popover when the label needs richer content).
 *
 * The Provider lives at the root layout — do NOT mount another one
 * here or the delays start fighting each other.
 */

interface HoverTooltipProps extends Omit<
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
  'content' | 'children'
> {
  /** Renders the tooltip bubble. String for short labels, ReactNode for
   *  inline keyword pills / shortcut hints. */
  label: ReactNode;
  /** The trigger. Should be a single focusable element so Radix can
   *  forward refs + ARIA wiring. */
  children: ReactNode;
  /** Whether to surface the label even when not hovered (forced open
   *  is rare; useful during onboarding tours). */
  open?: boolean;
}

export function HoverTooltip({
  label,
  children,
  open,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  ...contentProps
}: HoverTooltipProps) {
  if (label == null || label === '') return <>{children}</>;
  return (
    <TooltipPrimitive.Root open={open}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 z-50 max-w-xs rounded-md border border-zinc-800 bg-zinc-900/95 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-200 shadow-xl backdrop-blur"
          {...contentProps}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-zinc-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
