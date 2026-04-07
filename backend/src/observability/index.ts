import { RunTracer } from './run-tracer';

export { RunTracer } from './run-tracer';
export type { StartRunInput, StartStepInput } from './run-tracer';

/**
 * Process-wide singleton run tracer. Built lazily on first request so
 * test environments that never call this never instantiate it.
 *
 * Tests can swap the singleton with `setRunTracerForTest()` and reset
 * with `resetRunTracerForTest()`.
 */
let tracerSingleton: RunTracer | null = null;

export function getRunTracer(): RunTracer {
    if (!tracerSingleton) {
        tracerSingleton = new RunTracer();
    }
    return tracerSingleton;
}

export function setRunTracerForTest(tracer: RunTracer): void {
    tracerSingleton = tracer;
}

export function resetRunTracerForTest(): void {
    tracerSingleton = null;
}
