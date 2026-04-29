import type { PrismaClient } from '@prisma/client';

import { WebhookReceiptService } from '../../../runbook/services/webhook-receipt.service';

/**
 * Pinned behaviour: the service writes the row first, then emits a
 * Prometheus counter labelled with the source + status the call site
 * provided. A DB failure must NOT increment the counter — the metric
 * mirrors the persisted truth, not the attempted truth.
 */

function makePrismaStub(
  opts: {
    createOk?: boolean;
  } = {}
): PrismaClient {
  const create =
    opts.createOk === false
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockResolvedValue({ id: 'rcpt-1' });
  return {
    webhookReceipt: {
      create,
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  } as unknown as PrismaClient;
}

describe('WebhookReceiptService.record metric emission', () => {
  it('increments operari_webhook_received_total with source + status on a successful insert', async () => {
    const metrics = {
      recordRunStarted: jest.fn(),
      recordRunFinished: jest.fn(),
      recordStepFinished: jest.fn(),
      recordWebhookReceived: jest.fn(),
    };
    const service = new WebhookReceiptService(makePrismaStub(), metrics);

    const id = await service.record({
      webhookId: 'hook-1',
      tenantId: 't1',
      source: 'sentry',
      status: 'accepted',
      statusCode: 202,
      headers: {},
      body: {},
    });

    expect(id).toBe('rcpt-1');
    expect(metrics.recordWebhookReceived).toHaveBeenCalledWith({
      tenantId: 't1',
      source: 'sentry',
      status: 'accepted',
    });
  });

  it('falls back to source="unknown" when the call site forgot to thread it', async () => {
    const metrics = {
      recordRunStarted: jest.fn(),
      recordRunFinished: jest.fn(),
      recordStepFinished: jest.fn(),
      recordWebhookReceived: jest.fn(),
    };
    const service = new WebhookReceiptService(makePrismaStub(), metrics);

    await service.record({
      webhookId: 'hook-1',
      tenantId: 't1',
      status: 'rejected_signature',
      statusCode: 401,
      headers: {},
      body: {},
    });

    expect(metrics.recordWebhookReceived).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'unknown', status: 'rejected_signature' })
    );
  });

  it('does NOT increment the counter when the DB write fails', async () => {
    const metrics = {
      recordRunStarted: jest.fn(),
      recordRunFinished: jest.fn(),
      recordStepFinished: jest.fn(),
      recordWebhookReceived: jest.fn(),
    };
    const service = new WebhookReceiptService(makePrismaStub({ createOk: false }), metrics);

    const id = await service.record({
      webhookId: 'hook-1',
      tenantId: 't1',
      source: 'datadog',
      status: 'error',
      statusCode: 500,
      headers: {},
      body: {},
    });

    expect(id).toBeNull();
    expect(metrics.recordWebhookReceived).not.toHaveBeenCalled();
  });

  it('defaults to NULL_METRICS so existing call sites that pass only prisma still work', async () => {
    // Type smoke: this would not compile if the metrics arg were
    // required. Runtime smoke: NULL_METRICS swallow does not throw.
    const service = new WebhookReceiptService(makePrismaStub());
    await expect(
      service.record({
        webhookId: 'hook-1',
        tenantId: 't1',
        status: 'accepted',
        statusCode: 202,
        headers: {},
        body: {},
      })
    ).resolves.toBe('rcpt-1');
  });
});
