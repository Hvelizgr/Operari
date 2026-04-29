import { reduceRunState, type ReplayableEvent } from '../../../runbook/engine/run-state.reducer';

const ev = (
  seq: number,
  type: string,
  payload: Record<string, unknown> = {},
  nodeId?: string
): ReplayableEvent => ({
  seq: BigInt(seq),
  type,
  nodeId: nodeId ?? null,
  payload,
});

describe('reduceRunState', () => {
  it('starts as PENDING when only run.created has been seen', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', {
        runbookId: 'wf-1',
        workflowName: 'Deploy',
        trigger: 'manual',
      }),
    ]);
    expect(state.status).toBe('PENDING');
    expect(state.runbookId).toBe('wf-1');
    expect(state.workflowName).toBe('Deploy');
    expect(state.trigger).toBe('manual');
    expect(state.lastSeq).toBe(1n);
  });

  it('transitions PENDING → RUNNING on run.started', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', { startedAt: '2026-04-07T00:00:00Z' }),
    ]);
    expect(state.status).toBe('RUNNING');
  });

  it('counts step.completed events and tracks node ids', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'step.completed', { nodeName: 'a', nodeType: 'HTTP', durationMs: 5 }, 'n-1'),
      ev(4, 'step.completed', { nodeName: 'b', nodeType: 'Email', durationMs: 7 }, 'n-2'),
      ev(
        5,
        'step.failed',
        { nodeName: 'c', nodeType: 'HTTP', durationMs: 3, errorMessage: 'oops' },
        'n-3'
      ),
      ev(6, 'step.skipped', { nodeName: 'd', nodeType: 'HTTP', reason: 'parent failed' }, 'n-4'),
    ]);
    expect(state.stepCount).toBe(4);
    expect(state.completedSteps).toEqual(['n-1', 'n-2']);
    expect(state.failedSteps).toEqual(['n-3']);
    expect(state.skippedSteps).toEqual(['n-4']);
    // Step.failed alone does not promote to a terminal status
    expect(state.status).toBe('RUNNING');
  });

  it('transitions to COMPLETED on run.completed and records duration', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.completed', { durationMs: 1234, nodesExecuted: 5 }),
    ]);
    expect(state.status).toBe('COMPLETED');
    expect(state.durationMs).toBe(1234);
  });

  it('transitions to FAILED on run.failed and records error message', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.failed', { durationMs: 500, errorMessage: 'shell exited 1' }),
    ]);
    expect(state.status).toBe('FAILED');
    expect(state.errorMessage).toBe('shell exited 1');
    expect(state.durationMs).toBe(500);
  });

  it('PAUSED state records the pause node, RESUMED clears it', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.paused', { pausedAtNodeId: 'n-approval' }),
    ]);
    expect(state.status).toBe('PAUSED');
    expect(state.pausedAt).toBe('n-approval');

    const resumed = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.paused', { pausedAtNodeId: 'n-approval' }),
      ev(4, 'run.resumed', {}),
    ]);
    expect(resumed.status).toBe('RUNNING');
    expect(resumed.pausedAt).toBeNull();
  });

  it('CANCELLED is terminal — later events are ignored', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.cancelled', { cancelledAt: '2026-04-07T00:00:00Z' }),
      ev(4, 'step.completed', { nodeName: 'late', nodeType: 'HTTP', durationMs: 1 }, 'n-9'),
    ]);
    expect(state.status).toBe('CANCELLED');
    // Late step.completed must NOT bump stepCount because the run is terminal
    expect(state.stepCount).toBe(0);
  });

  it('lastSeq tracks the highest seq seen across all events', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(7, 'run.started', {}),
      ev(42, 'step.completed', { nodeName: 'x', nodeType: 'HTTP', durationMs: 1 }, 'n'),
    ]);
    expect(state.lastSeq).toBe(42n);
  });

  it('ignores unknown event types (forward compatibility)', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'something.future', { foo: 'bar' }),
      ev(4, 'run.completed', { durationMs: 100, nodesExecuted: 0 }),
    ]);
    expect(state.status).toBe('COMPLETED');
    expect(state.lastSeq).toBe(4n);
  });

  it('returns a sane default for an empty event list', () => {
    const state = reduceRunState('exec-1', []);
    expect(state.status).toBe('PENDING');
    expect(state.lastSeq).toBe(0n);
    expect(state.stepCount).toBe(0);
    expect(state.completedStepOutputs).toEqual({});
    expect(state.inFlightSteps).toEqual([]);
  });

  // ─── Phase 4 (C1) — outputs + inFlightSteps tracking ─────────────

  it('captures step.completed.output into completedStepOutputs keyed by nodeId', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(
        3,
        'step.completed',
        { nodeName: 'a', nodeType: 'HTTP', durationMs: 5, output: { statusCode: 200 } },
        'n-1'
      ),
      ev(
        4,
        'step.completed',
        { nodeName: 'b', nodeType: 'Email', durationMs: 7, output: 'sent' },
        'n-2'
      ),
    ]);
    expect(state.completedStepOutputs).toEqual({
      'n-1': { statusCode: 200 },
      'n-2': 'sent',
    });
  });

  it('omits outputs when step.completed carries no output payload', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'step.completed', { nodeName: 'a', nodeType: 'Delay', durationMs: 5 }, 'n-1'),
    ]);
    expect(state.completedStepOutputs).toEqual({});
  });

  it('tracks a step as inFlight between step.started and step.completed', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(
        3,
        'step.started',
        { nodeName: 'a', nodeType: 'HTTP', startedAt: '2026-04-07T00:00:00Z' },
        'n-1'
      ),
      // Crash landed here — n-1 never got its terminal event.
    ]);
    expect(state.inFlightSteps).toEqual(['n-1']);
  });

  it('clears a step from inFlightSteps when step.completed lands', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(
        3,
        'step.started',
        { nodeName: 'a', nodeType: 'HTTP', startedAt: '2026-04-07T00:00:00Z' },
        'n-1'
      ),
      ev(
        4,
        'step.completed',
        { nodeName: 'a', nodeType: 'HTTP', durationMs: 5, output: { ok: true } },
        'n-1'
      ),
    ]);
    expect(state.inFlightSteps).toEqual([]);
    expect(state.completedSteps).toEqual(['n-1']);
  });

  it('clears a step from inFlightSteps on step.failed or step.skipped', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'step.started', { nodeName: 'a', nodeType: 'HTTP', startedAt: 't' }, 'n-1'),
      ev(
        4,
        'step.failed',
        { nodeName: 'a', nodeType: 'HTTP', durationMs: 5, errorMessage: 'oops' },
        'n-1'
      ),
      ev(5, 'step.started', { nodeName: 'b', nodeType: 'HTTP', startedAt: 't' }, 'n-2'),
      ev(6, 'step.skipped', { nodeName: 'b', nodeType: 'HTTP', reason: 'disabled' }, 'n-2'),
    ]);
    expect(state.inFlightSteps).toEqual([]);
  });

  it('retains only the steps still mid-flight when a later step completes', () => {
    // Two parallel branches — a finishes, b crashes mid-way.
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { runbookId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'step.started', { nodeName: 'a', nodeType: 'HTTP', startedAt: 't' }, 'n-1'),
      ev(4, 'step.started', { nodeName: 'b', nodeType: 'SSH', startedAt: 't' }, 'n-2'),
      ev(
        5,
        'step.completed',
        { nodeName: 'a', nodeType: 'HTTP', durationMs: 5, output: { ok: true } },
        'n-1'
      ),
      // Crash: n-2 has no terminal event.
    ]);
    expect(state.inFlightSteps).toEqual(['n-2']);
    expect(state.completedStepOutputs).toEqual({ 'n-1': { ok: true } });
  });
});
