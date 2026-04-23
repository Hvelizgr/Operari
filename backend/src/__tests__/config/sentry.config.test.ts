/**
 * Guards around Sentry integration. The whole point of the init
 * module is that self-host deployments never reach the SDK — these
 * tests pin that property so a refactor can't silently flip it.
 */

const initSpy = jest.fn();
const closeSpy = jest.fn().mockResolvedValue(true);
const captureSpy = jest.fn();
const withScopeSpy = jest.fn((cb: (s: unknown) => void) => cb({ setTag: jest.fn() }));
const setupExpressErrorHandlerSpy = jest.fn();

jest.mock('@sentry/node', () => ({
  __esModule: true,
  init: (...args: unknown[]) => initSpy(...args),
  close: (...args: unknown[]) => closeSpy(...args),
  captureException: (...args: unknown[]) => captureSpy(...args),
  withScope: (cb: (s: unknown) => void) => withScopeSpy(cb),
  setupExpressErrorHandler: (...args: unknown[]) => setupExpressErrorHandlerSpy(...args),
}));

describe('sentry.config', () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    jest.resetModules();
    initSpy.mockClear();
    closeSpy.mockClear();
    captureSpy.mockClear();
    withScopeSpy.mockClear();
    setupExpressErrorHandlerSpy.mockClear();
  });

  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it('skips Sentry.init entirely when SENTRY_DSN is not set', async () => {
    delete process.env.SENTRY_DSN;
    const mod = await import('../../config/sentry.config');
    mod.initSentry();
    expect(initSpy).not.toHaveBeenCalled();
    expect(mod.isSentryEnabled()).toBe(false);
  });

  it('calls Sentry.init with the DSN and the resolved sample rate when set', async () => {
    process.env.SENTRY_DSN = 'https://public@sentry.example/1';
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.25';
    process.env.SENTRY_ENV = 'staging';
    process.env.APP_VERSION = 'abc123';

    const mod = await import('../../config/sentry.config');
    mod.initSentry();

    expect(initSpy).toHaveBeenCalledTimes(1);
    const initArgs = initSpy.mock.calls[0]![0] as {
      dsn: string;
      environment: string;
      release: string;
      tracesSampleRate: number;
      sendDefaultPii: boolean;
    };
    expect(initArgs.dsn).toBe('https://public@sentry.example/1');
    expect(initArgs.environment).toBe('staging');
    expect(initArgs.release).toBe('abc123');
    expect(initArgs.tracesSampleRate).toBe(0.25);
    expect(initArgs.sendDefaultPii).toBe(false);
    expect(mod.isSentryEnabled()).toBe(true);
  });

  it('captureError is a no-op when Sentry was not initialized', async () => {
    delete process.env.SENTRY_DSN;
    const mod = await import('../../config/sentry.config');
    // Never called init, so captureError must not touch Sentry.
    mod.captureError(new Error('boom'), { runbook: 'test' });
    expect(withScopeSpy).not.toHaveBeenCalled();
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it('captureError tags the scope when Sentry is enabled', async () => {
    process.env.SENTRY_DSN = 'https://public@sentry.example/1';
    const mod = await import('../../config/sentry.config');
    mod.initSentry();
    mod.captureError(new Error('boom'), { runbook: 'rollback' });
    expect(withScopeSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(1);
  });

  it('flushSentry does not call close when disabled', async () => {
    delete process.env.SENTRY_DSN;
    const mod = await import('../../config/sentry.config');
    await mod.flushSentry(500);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('flushSentry calls close with the timeout when enabled', async () => {
    process.env.SENTRY_DSN = 'https://public@sentry.example/1';
    const mod = await import('../../config/sentry.config');
    mod.initSentry();
    await mod.flushSentry(500);
    expect(closeSpy).toHaveBeenCalledWith(500);
  });
});
