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
        workflowId: 'wf-1',
        workflowName: 'Deploy',
        trigger: 'manual',
      }),
    ]);
    expect(state.status).toBe('PENDING');
    expect(state.workflowId).toBe('wf-1');
    expect(state.workflowName).toBe('Deploy');
    expect(state.trigger).toBe('manual');
    expect(state.lastSeq).toBe(1n);
  });

  it('transitions PENDING → RUNNING on run.started', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', { startedAt: '2026-04-07T00:00:00Z' }),
    ]);
    expect(state.status).toBe('RUNNING');
  });

  it('counts step.completed events and tracks node ids', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
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
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.completed', { durationMs: 1234, nodesExecuted: 5 }),
    ]);
    expect(state.status).toBe('COMPLETED');
    expect(state.durationMs).toBe(1234);
  });

  it('transitions to FAILED on run.failed and records error message', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.failed', { durationMs: 500, errorMessage: 'shell exited 1' }),
    ]);
    expect(state.status).toBe('FAILED');
    expect(state.errorMessage).toBe('shell exited 1');
    expect(state.durationMs).toBe(500);
  });

  it('PAUSED state records the pause node, RESUMED clears it', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.paused', { pausedAtNodeId: 'n-approval' }),
    ]);
    expect(state.status).toBe('PAUSED');
    expect(state.pausedAt).toBe('n-approval');

    const resumed = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(2, 'run.started', {}),
      ev(3, 'run.paused', { pausedAtNodeId: 'n-approval' }),
      ev(4, 'run.resumed', {}),
    ]);
    expect(resumed.status).toBe('RUNNING');
    expect(resumed.pausedAt).toBeNull();
  });

  it('CANCELLED is terminal — later events are ignored', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
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
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
      ev(7, 'run.started', {}),
      ev(42, 'step.completed', { nodeName: 'x', nodeType: 'HTTP', durationMs: 1 }, 'n'),
    ]);
    expect(state.lastSeq).toBe(42n);
  });

  it('ignores unknown event types (forward compatibility)', () => {
    const state = reduceRunState('exec-1', [
      ev(1, 'run.created', { workflowId: 'wf', workflowName: 'wf', trigger: 'manual' }),
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
  });
});
