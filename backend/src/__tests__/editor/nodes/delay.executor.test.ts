import { DelayNodeExecutor } from '../../../editor/nodes/delay.executor';

describe('DelayNodeExecutor', () => {
  const executor = new DelayNodeExecutor();
  const errCtx = { nodeId: 'n', nodeName: 'Delay', nodeType: 'Delay' };

  it('exposes type=Delay and Wait alias', () => {
    expect(executor.type).toBe('Delay');
    expect(executor.aliases).toEqual(['Wait']);
  });

  it('sleeps for the configured duration and returns delayed=true', async () => {
    const start = Date.now();
    const result = await executor.execute({ duration: 80 }, {}, errCtx);
    const elapsed = Date.now() - start;
    expect(result.delayed).toBe(true);
    expect(result.duration).toBe(80);
    // Allow generous slack for slow CI
    expect(elapsed).toBeGreaterThanOrEqual(75);
    expect(elapsed).toBeLessThan(500);
  });

  it('defaults to 1000 ms when duration is omitted', async () => {
    // Use a fake to avoid actually waiting 1s
    jest.useFakeTimers();
    const promise = executor.execute({}, {}, errCtx);
    jest.advanceTimersByTime(1000);
    const result = await promise;
    jest.useRealTimers();
    expect(result.duration).toBe(1000);
    expect(result.delayed).toBe(true);
  });
});
