import { RunTracer } from '../../observability/run-tracer';

/**
 * Recording tracer fake — implements the subset of @opentelemetry/api
 * that RunTracer uses, captures spans into arrays so the test can
 * assert on attributes, status, and lifecycle.
 */
interface FakeSpan {
  name: string;
  attributes: Record<string, unknown>;
  status?: { code: number; message?: string };
  ended: boolean;
  setAttribute(key: string, value: unknown): void;
  setStatus(s: { code: number; message?: string }): void;
  end(): void;
}

interface FakeTracer {
  startSpan(name: string, opts?: { attributes?: Record<string, unknown> }): FakeSpan;
  spans: FakeSpan[];
}

const buildFakeTracer = (): FakeTracer => {
  const spans: FakeSpan[] = [];
  return {
    spans,
    startSpan(name, opts) {
      const span: FakeSpan = {
        name,
        attributes: { ...(opts?.attributes ?? {}) },
        ended: false,
        setAttribute(key, value) {
          this.attributes[key] = value;
        },
        setStatus(s) {
          this.status = s;
        },
        end() {
          this.ended = true;
        },
      };
      spans.push(span);
      return span;
    },
  };
};

describe('RunTracer', () => {
  let fake: FakeTracer;
  let tracer: RunTracer;

  beforeEach(() => {
    fake = buildFakeTracer();
    tracer = new RunTracer(fake as never);
  });

  describe('startRun / endRun', () => {
    it('opens a run span with the documented attributes', () => {
      tracer.startRun({
        runId: 'run-1',
        runbookId: 'wf-1',
        runbookName: 'Deploy Production',
        tenantId: 't-1',
        trigger: 'manual',
        runnerType: 'docker',
      });

      expect(fake.spans).toHaveLength(1);
      const span = fake.spans[0];
      expect(span.name).toBe('run:Deploy Production');
      expect(span.attributes['operari.run.id']).toBe('run-1');
      expect(span.attributes['runbook.id']).toBe('wf-1');
      expect(span.attributes['runbook.name']).toBe('Deploy Production');
      expect(span.attributes['tenant.id']).toBe('t-1');
      expect(span.attributes['trigger']).toBe('manual');
      expect(span.attributes['runner.type']).toBe('docker');
    });

    it('omits runner.type when not provided', () => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'webhook',
      });
      expect(fake.spans[0].attributes['runner.type']).toBeUndefined();
    });

    it('endRun(success=true) sets OK status and ends the span', () => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.endRun('r', true);
      const span = fake.spans[0];
      expect(span.ended).toBe(true);
      expect(span.status?.code).toBe(1); // SpanStatusCode.OK
    });

    it('endRun(success=false) sets ERROR status and records error.code/message attributes', () => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.endRun('r', false, { message: 'something broke', code: 'SHELL_FAIL' });
      const span = fake.spans[0];
      expect(span.ended).toBe(true);
      expect(span.status?.code).toBe(2); // SpanStatusCode.ERROR
      expect(span.attributes['error.code']).toBe('SHELL_FAIL');
      expect(span.attributes['error.message']).toBe('something broke');
    });

    it('endRun is idempotent — second call is a no-op', () => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.endRun('r', true);
      tracer.endRun('r', false); // should not do anything
      expect(fake.spans.length).toBe(1);
    });

    it('startRun is idempotent — second call for same id is a no-op', () => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf-2',
        runbookName: 'wf-2',
        tenantId: 't-2',
        trigger: 'webhook',
      });
      expect(fake.spans).toHaveLength(1);
    });
  });

  describe('startStep / endStep', () => {
    beforeEach(() => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
    });

    it('opens a step span with the documented attributes', () => {
      tracer.startStep({
        runId: 'r',
        stepId: 's-1',
        stepName: 'fetch user',
        stepType: 'HTTP',
      });
      const stepSpan = fake.spans[1];
      expect(stepSpan.name).toBe('step:HTTP:fetch user');
      expect(stepSpan.attributes['step.id']).toBe('s-1');
      expect(stepSpan.attributes['step.name']).toBe('fetch user');
      expect(stepSpan.attributes['step.type']).toBe('HTTP');
      expect(stepSpan.attributes['operari.run.id']).toBe('r');
    });

    it('endStep records duration_ms and success=true', async () => {
      tracer.startStep({
        runId: 'r',
        stepId: 's-1',
        stepName: 'x',
        stepType: 'Delay',
      });
      // Yield to let the clock tick at least 1 ms
      await new Promise(resolve => setTimeout(resolve, 5));
      tracer.endStep('r', 's-1', true);
      const stepSpan = fake.spans[1];
      expect(stepSpan.ended).toBe(true);
      expect(stepSpan.attributes['step.success']).toBe(true);
      expect(typeof stepSpan.attributes['step.duration_ms']).toBe('number');
      expect(stepSpan.attributes['step.duration_ms']).toBeGreaterThanOrEqual(0);
    });

    it('endStep(success=false) records error.code and error.message', () => {
      tracer.startStep({
        runId: 'r',
        stepId: 's-1',
        stepName: 'x',
        stepType: 'HTTP',
      });
      tracer.endStep('r', 's-1', false, { message: '404 not found', code: 'HTTP_REQUEST_FAILED' });
      const stepSpan = fake.spans[1];
      expect(stepSpan.status?.code).toBe(2);
      expect(stepSpan.attributes['error.code']).toBe('HTTP_REQUEST_FAILED');
      expect(stepSpan.attributes['error.message']).toBe('404 not found');
      expect(stepSpan.attributes['step.success']).toBe(false);
    });

    it('endStep is idempotent — second call is a no-op', () => {
      tracer.startStep({
        runId: 'r',
        stepId: 's-1',
        stepName: 'x',
        stepType: 'Delay',
      });
      tracer.endStep('r', 's-1', true);
      tracer.endStep('r', 's-1', false); // no-op
      const stepSpan = fake.spans[1];
      expect(stepSpan.attributes['step.success']).toBe(true);
    });

    it('endStep for an unknown step is a no-op (no throw)', () => {
      expect(() => tracer.endStep('r', 'never-started', true)).not.toThrow();
    });
  });

  describe('lifecycle bookkeeping', () => {
    it('inFlightCount tracks active runs and steps', () => {
      expect(tracer.inFlightCount).toEqual({ runs: 0, steps: 0 });
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
      expect(tracer.inFlightCount.runs).toBe(1);
      tracer.startStep({
        runId: 'r',
        stepId: 's-1',
        stepName: 'x',
        stepType: 'HTTP',
      });
      expect(tracer.inFlightCount.steps).toBe(1);
      tracer.endStep('r', 's-1', true);
      tracer.endRun('r', true);
      expect(tracer.inFlightCount).toEqual({ runs: 0, steps: 0 });
    });

    it('endRun cleans up leftover step spans defensively', () => {
      tracer.startRun({
        runId: 'r',
        runbookId: 'wf',
        runbookName: 'wf',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.startStep({
        runId: 'r',
        stepId: 's-1',
        stepName: 'x',
        stepType: 'HTTP',
      });
      tracer.startStep({
        runId: 'r',
        stepId: 's-2',
        stepName: 'y',
        stepType: 'Delay',
      });
      // Run ends without anyone calling endStep
      tracer.endRun('r', false, { message: 'crashed' });
      // Both step spans should be ended
      expect(fake.spans[1].ended).toBe(true);
      expect(fake.spans[2].ended).toBe(true);
      expect(tracer.inFlightCount).toEqual({ runs: 0, steps: 0 });
    });

    it('does NOT cross-contaminate steps from different runs', () => {
      tracer.startRun({
        runId: 'run-A',
        runbookId: 'wf',
        runbookName: 'A',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.startRun({
        runId: 'run-B',
        runbookId: 'wf',
        runbookName: 'B',
        tenantId: 't',
        trigger: 'manual',
      });
      tracer.startStep({
        runId: 'run-A',
        stepId: 's-1',
        stepName: 'x',
        stepType: 'HTTP',
      });
      tracer.startStep({
        runId: 'run-B',
        stepId: 's-1',
        stepName: 'y',
        stepType: 'HTTP',
      });
      // End run A: only its step span gets cleaned, run B's stays alive
      tracer.endRun('run-A', true);
      expect(tracer.inFlightCount).toEqual({ runs: 1, steps: 1 });
    });
  });

  describe('metrics integration', () => {
    it('forwards run + step lifecycle into the injected RunMetrics sink', () => {
      const sink = {
        recordRunStarted: jest.fn(),
        recordRunFinished: jest.fn(),
        recordStepFinished: jest.fn(),
        recordWebhookReceived: jest.fn(),
      };
      const t = new RunTracer(buildFakeTracer() as never, sink);

      t.startRun({
        runId: 'run-X',
        runbookId: 'wf',
        runbookName: 'X',
        tenantId: 'tenant-x',
        trigger: 'webhook',
        runnerType: 'docker',
      });
      t.startStep({ runId: 'run-X', stepId: 's-1', stepName: 'do', stepType: 'shell' });
      t.endStep('run-X', 's-1', true);
      t.endRun('run-X', true);

      expect(sink.recordRunStarted).toHaveBeenCalledWith({
        tenantId: 'tenant-x',
        trigger: 'webhook',
        runnerType: 'docker',
      });
      expect(sink.recordStepFinished).toHaveBeenCalledWith({
        tenantId: 'tenant-x',
        stepType: 'shell',
        success: true,
        durationSeconds: expect.any(Number),
      });
      expect(sink.recordRunFinished).toHaveBeenCalledWith({
        tenantId: 'tenant-x',
        trigger: 'webhook',
        success: true,
        durationSeconds: expect.any(Number),
      });
    });

    it('marks the run as failed in metrics when endRun(success=false)', () => {
      const sink = {
        recordRunStarted: jest.fn(),
        recordRunFinished: jest.fn(),
        recordStepFinished: jest.fn(),
        recordWebhookReceived: jest.fn(),
      };
      const t = new RunTracer(buildFakeTracer() as never, sink);

      t.startRun({
        runId: 'run-Z',
        runbookId: 'wf',
        runbookName: 'Z',
        tenantId: 'tenant-z',
        trigger: 'manual',
      });
      t.endRun('run-Z', false, { code: 'BOOM' });

      expect(sink.recordRunFinished).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-z', trigger: 'manual', success: false })
      );
    });
  });
});
