import { act, renderHook } from '@testing-library/react';

import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';

/**
 * Response stub: every test path exercises a distinct status +
 * body combination. Keeping the shape permissive (any) here is
 * deliberate — this file never runs under production tsc.
 */
const fetchMock = jest.fn();

beforeEach(() => {
  (global as any).fetch = fetchMock;
  fetchMock.mockReset();
});

function stubResponse(init: { status: number; body?: unknown }) {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    json: async () => init.body ?? {},
  };
}

describe('useWorkflowExecution.executeWorkflow', () => {
  it('returns kind="ok" with the execution id on success', async () => {
    fetchMock.mockResolvedValue(stubResponse({ status: 202, body: { id: 'run-1' } }));

    const { result } = renderHook(() => useWorkflowExecution('wf-1'));
    let out: Awaited<ReturnType<typeof result.current.executeWorkflow>>;
    await act(async () => {
      out = await result.current.executeWorkflow({ env: 'prod' }, 'run');
    });

    expect(out).toEqual({ kind: 'ok', executionId: 'run-1' });
  });

  it('returns kind="invalid_inputs" with the issue list when the backend rejects inputs', async () => {
    fetchMock.mockResolvedValue(
      stubResponse({
        status: 400,
        body: {
          error: 'Invalid run inputs',
          code: 'invalid_run_inputs',
          issues: [{ field: 'env', message: 'env is required' }],
        },
      })
    );

    const { result } = renderHook(() => useWorkflowExecution('wf-1'));
    let out: Awaited<ReturnType<typeof result.current.executeWorkflow>>;
    await act(async () => {
      out = await result.current.executeWorkflow({}, 'run');
    });

    expect(out).toEqual({
      kind: 'invalid_inputs',
      issues: [{ field: 'env', message: 'env is required' }],
    });
  });

  it('returns kind="error" for other non-2xx responses', async () => {
    fetchMock.mockResolvedValue(stubResponse({ status: 500, body: { error: 'boom' } }));

    const { result } = renderHook(() => useWorkflowExecution('wf-1'));
    let out: Awaited<ReturnType<typeof result.current.executeWorkflow>>;
    await act(async () => {
      out = await result.current.executeWorkflow({}, 'run');
    });

    expect(out?.kind).toBe('error');
  });

  it('returns kind="error" when a 400 response is missing invalid_run_inputs shape', async () => {
    // A non-validator 400 (e.g., generic bad-request from a different
    // route) must NOT be mis-reported as an invalid_inputs signal —
    // falls through to the generic error banner instead.
    fetchMock.mockResolvedValue(
      stubResponse({
        status: 400,
        body: { error: 'Something else' },
      })
    );

    const { result } = renderHook(() => useWorkflowExecution('wf-1'));
    let out: Awaited<ReturnType<typeof result.current.executeWorkflow>>;
    await act(async () => {
      out = await result.current.executeWorkflow({}, 'run');
    });

    expect(out?.kind).toBe('error');
  });

  it('sends debug=true when mode=debug', async () => {
    fetchMock.mockResolvedValue(stubResponse({ status: 202, body: { id: 'run-d' } }));

    const { result } = renderHook(() => useWorkflowExecution('wf-1'));
    await act(async () => {
      await result.current.executeWorkflow({ x: 1 }, 'debug');
    });

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse((opts as { body: string }).body);
    expect(body.debug).toBe(true);
    expect(body.dryRun).toBeUndefined();
  });

  it('sends dryRun=true when mode=dry-run', async () => {
    fetchMock.mockResolvedValue(stubResponse({ status: 202, body: { id: 'run-dr' } }));

    const { result } = renderHook(() => useWorkflowExecution('wf-1'));
    await act(async () => {
      await result.current.executeWorkflow({}, 'dry-run');
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.dryRun).toBe(true);
  });
});
