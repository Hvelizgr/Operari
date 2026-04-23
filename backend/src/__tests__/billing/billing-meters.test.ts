import { buildBillingMeter } from '../../billing';
import type { BillableEvent } from '../../billing/billing-meter.types';
import { NoopBillingMeter } from '../../billing/noop-billing-meter';
import { StripeBillingMeter } from '../../billing/stripe-billing-meter';

describe('NoopBillingMeter', () => {
  const meter = new NoopBillingMeter();

  it('exposes name="noop"', () => {
    expect(meter.name).toBe('noop');
  });

  it('returns false for every event (no-op)', async () => {
    const event: BillableEvent = {
      type: 'run.started',
      customerId: 'cus_xxx',
      value: 1,
    };
    await expect(meter.record(event)).resolves.toBe(false);
  });

  it('never throws on any input shape', async () => {
    for (const value of [0, 1, 1000, -1, NaN, Number.MAX_SAFE_INTEGER]) {
      await expect(meter.record({ type: 'runner.minute', value, customerId: 'c' })).resolves.toBe(
        false
      );
    }
  });
});

describe('StripeBillingMeter', () => {
  it('exposes name="stripe"', () => {
    const meter = new StripeBillingMeter({ sendMeterEvent: jest.fn() });
    expect(meter.name).toBe('stripe');
  });

  it('maps internal event type to the configured Stripe meter name', async () => {
    const sendMeterEvent = jest.fn().mockResolvedValue(undefined);
    const meter = new StripeBillingMeter({ sendMeterEvent });

    await meter.record({
      type: 'run.started',
      customerId: 'cus_acme',
      value: 1,
      idempotencyKey: 'run.started:run-1',
      metadata: { runId: 'run-1' },
    });

    expect(sendMeterEvent).toHaveBeenCalledWith({
      event_name: 'nanorun_runs',
      customer_id: 'cus_acme',
      value: 1,
      identifier: 'run.started:run-1',
      metadata: { runId: 'run-1' },
    });
  });

  it('returns false (no-op) when customerId is missing', async () => {
    const sendMeterEvent = jest.fn();
    const meter = new StripeBillingMeter({ sendMeterEvent });

    const ok = await meter.record({
      type: 'run.started',
      value: 1,
    });

    expect(ok).toBe(false);
    expect(sendMeterEvent).not.toHaveBeenCalled();
  });

  it('returns false (no-op) when the event type has no Stripe mapping', async () => {
    const sendMeterEvent = jest.fn();
    const meter = new StripeBillingMeter({
      sendMeterEvent,
      meterNameMap: { 'run.started': '' }, // Empty override won't match
    });

    // We can't easily produce an "unknown" type because the type
    // system enforces BillableEventType, but we can test that the
    // implementation refuses an event whose mapping resolves to
    // an empty/falsy string.
    const ok = await meter.record({
      type: 'run.started',
      customerId: 'c',
      value: 1,
    });

    // Empty mapping should not call sendMeterEvent — the meter
    // refuses to send an event with no name.
    expect(ok).toBe(false);
    expect(sendMeterEvent).not.toHaveBeenCalled();
  });

  it('honors meterNameMap overrides', async () => {
    const sendMeterEvent = jest.fn().mockResolvedValue(undefined);
    const meter = new StripeBillingMeter({
      sendMeterEvent,
      meterNameMap: { 'run.started': 'my_custom_meter' },
    });

    await meter.record({
      type: 'run.started',
      customerId: 'c',
      value: 1,
    });

    expect(sendMeterEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: 'my_custom_meter' })
    );
  });

  it('returns false (no-op) when sendMeterEvent throws', async () => {
    const sendMeterEvent = jest.fn().mockRejectedValue(new Error('Stripe down'));
    const meter = new StripeBillingMeter({ sendMeterEvent });

    const ok = await meter.record({
      type: 'run.started',
      customerId: 'c',
      value: 1,
    });

    expect(ok).toBe(false);
  });

  it('records each of the documented event types via the default mapping', async () => {
    const sendMeterEvent = jest.fn().mockResolvedValue(undefined);
    const meter = new StripeBillingMeter({ sendMeterEvent });
    const types: Array<{ type: BillableEvent['type']; expected: string }> = [
      { type: 'run.started', expected: 'nanorun_runs' },
      { type: 'run.completed', expected: 'nanorun_runs_completed' },
      { type: 'runner.minute', expected: 'nanorun_runner_minutes' },
      { type: 'storage.gb_hour', expected: 'nanorun_storage_gb_hours' },
    ];

    for (const { type } of types) {
      await meter.record({ type, customerId: 'c', value: 1 });
    }

    const calls = sendMeterEvent.mock.calls;
    expect(calls.length).toBe(types.length);
    for (let i = 0; i < types.length; i++) {
      expect(calls[i][0].event_name).toBe(types[i].expected);
    }
  });
});

describe('buildBillingMeter', () => {
  const ORIGINAL = process.env.NANORUN_BILLING_PROVIDER;
  afterEach(() => {
    process.env.NANORUN_BILLING_PROVIDER = ORIGINAL;
  });

  it('defaults to NoopBillingMeter', () => {
    delete process.env.NANORUN_BILLING_PROVIDER;
    expect(buildBillingMeter().name).toBe('noop');
  });

  it('returns StripeBillingMeter when env=stripe', () => {
    process.env.NANORUN_BILLING_PROVIDER = 'stripe';
    expect(buildBillingMeter().name).toBe('stripe');
  });

  it('falls back to noop for unknown providers', () => {
    process.env.NANORUN_BILLING_PROVIDER = 'orb-eventually';
    expect(buildBillingMeter().name).toBe('noop');
  });
});
