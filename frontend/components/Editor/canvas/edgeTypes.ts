import type { EdgeTypes } from '@xyflow/react';

import { SmartBezierEdge } from './edges/SmartBezierEdge';
import { SmartStepEdge } from './edges/SmartStepEdge';

export const edgeTypes: EdgeTypes = {
  smart: SmartBezierEdge,
  step: SmartStepEdge,
};

export type LineStyle = 'smart' | 'step';

export const DEFAULT_EDGE_TYPE: LineStyle = 'smart';

const LINE_STYLE_KEY = 'operari:line-style';

const isLineStyle = (value: unknown): value is LineStyle => value === 'smart' || value === 'step';

/**
 * Persisted user preference for edge routing. Lives in localStorage
 * because the choice is "how I like to read graphs", not a property of
 * the runbook — switching styles should not dirty the file.
 *
 * SSR-safe: returns the default during the initial render, picks up
 * the stored value via the consumer's effect on hydration.
 */
export const readLineStyle = (): LineStyle => {
  if (typeof localStorage === 'undefined') return DEFAULT_EDGE_TYPE;
  try {
    const raw = localStorage.getItem(LINE_STYLE_KEY);
    return isLineStyle(raw) ? raw : DEFAULT_EDGE_TYPE;
  } catch {
    return DEFAULT_EDGE_TYPE;
  }
};

export const writeLineStyle = (next: LineStyle): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LINE_STYLE_KEY, next);
  } catch {
    // best-effort: quota / private mode
  }
};
