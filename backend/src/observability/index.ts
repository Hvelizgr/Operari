import { trace } from '@opentelemetry/api';

import { getMetrics, NULL_METRICS } from './metrics';
import { RunTracer } from './run-tracer';

export type { StartRunInput, StartStepInput } from './run-tracer';
export { RunTracer } from './run-tracer';
export { getMetrics, buildMetrics, NULL_METRICS, resetMetricsForTesting } from './metrics';
export type { RunMetrics } from './metrics';

/**
 * Process-wide singleton run tracer. Built lazily on first request so
 * test environments that never call this never instantiate it.
 *
 * The tracer dual-writes to OpenTelemetry spans (always-on, no-op when
 * the SDK is not registered) and Prometheus metrics (gated behind
 * OPERARI_METRICS_ENABLED — when off, the no-op NULL_METRICS sink
 * runs and no series are registered).
 *
 * Tests can swap the singleton with `setRunTracerForTest()` and reset
 * with `resetRunTracerForTest()`.
 */
let tracerSingleton: RunTracer | null = null;

export function getRunTracer(): RunTracer {
  if (!tracerSingleton) {
    const metricsEnabled = process.env.OPERARI_METRICS_ENABLED === 'true';
    const metrics = metricsEnabled ? getMetrics() : NULL_METRICS;
    tracerSingleton = new RunTracer(trace.getTracer('operari.runs'), metrics);
  }
  return tracerSingleton;
}

export function setRunTracerForTest(tracer: RunTracer): void {
  tracerSingleton = tracer;
}

export function resetRunTracerForTest(): void {
  tracerSingleton = null;
}
