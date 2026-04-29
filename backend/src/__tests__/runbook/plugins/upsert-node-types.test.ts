import type { PrismaClient } from '@prisma/client';

import type { PluginNodeMetadata } from '../../../runbook/plugins/loader';
import { upsertPluginNodeTypes } from '../../../runbook/plugins/upsert-node-types';

/**
 * Pinned behaviour: every plugin manifest produces exactly one
 * NodeType upsert keyed on `type`, defaults fill the gaps left by
 * a minimal plugin, and a thrown upsert never blocks subsequent
 * manifests (one bad plugin must not poison the rest).
 */

function makePrismaStub(opts: { failOn?: string[] } = {}): {
  prisma: PrismaClient;
  upsert: jest.Mock;
} {
  const failures = new Set(opts.failOn ?? []);
  const upsert = jest.fn(async (args: { where: { type: string } }) => {
    if (failures.has(args.where.type)) {
      throw new Error(`db down for ${args.where.type}`);
    }
    return undefined;
  });
  const prisma = {
    nodeType: { upsert },
  } as unknown as PrismaClient;
  return { prisma, upsert };
}

const richManifest: PluginNodeMetadata = {
  type: 'acme.slack-notify',
  source: 'acme:slack-notify.js',
  label: { en: 'Slack notify', es: 'Notificar Slack' },
  description: 'Post a Slack message',
  icon: 'Send',
  color: 'bg-pink-500',
  category: 'integrations',
  inputs: [{ name: 'main', type: 'main' }],
  outputs: [{ name: 'main', type: 'main' }],
  properties: [
    { name: 'webhook', displayName: 'Webhook URL', type: 'secret' },
    { name: 'message', displayName: 'Message', type: 'string' },
  ],
};

const bareManifest: PluginNodeMetadata = {
  type: 'acme.bare',
  source: 'acme:bare.js',
};

describe('upsertPluginNodeTypes', () => {
  it('returns 0/0 cleanly when called with an empty manifest list', async () => {
    const { prisma, upsert } = makePrismaStub();
    const out = await upsertPluginNodeTypes(prisma, []);
    expect(out).toEqual({ upserted: 0, failed: 0 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('round-trips rich metadata onto the upsert payload', async () => {
    const { prisma, upsert } = makePrismaStub();

    const out = await upsertPluginNodeTypes(prisma, [richManifest]);

    expect(out).toEqual({ upserted: 1, failed: 0 });
    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({ type: 'acme.slack-notify' });
    expect(args.create.tenantId).toBeNull();
    expect(args.create.icon).toBe('Send');
    expect(args.create.category).toBe('integrations');
    expect(args.create.label).toEqual({ en: 'Slack notify', es: 'Notificar Slack' });
    expect(Array.isArray(args.create.properties)).toBe(true);
    expect(args.create.properties).toHaveLength(2);
  });

  it('fills sensible defaults for a bare manifest (icon, color, category, ports, empty properties)', async () => {
    const { prisma, upsert } = makePrismaStub();

    await upsertPluginNodeTypes(prisma, [bareManifest]);

    const args = upsert.mock.calls[0][0];
    expect(args.create.icon).toBe('Plug');
    expect(args.create.color).toBe('bg-purple-500');
    expect(args.create.category).toBe('custom');
    expect(args.create.inputs).toEqual([{ name: 'main', type: 'main' }]);
    expect(args.create.outputs).toEqual([{ name: 'main', type: 'main' }]);
    expect(args.create.properties).toEqual([]);
    // label normalizes a missing string to the type itself, mirrored in es.
    expect(args.create.label).toEqual({ en: 'acme.bare', es: 'acme.bare' });
  });

  it('coerces a plain-string label into both en + es', async () => {
    const { prisma, upsert } = makePrismaStub();
    await upsertPluginNodeTypes(prisma, [{ ...bareManifest, label: 'Just a string' }]);
    const args = upsert.mock.calls[0][0];
    expect(args.create.label).toEqual({ en: 'Just a string', es: 'Just a string' });
  });

  it('continues after a failing upsert and reports counts', async () => {
    const { prisma, upsert } = makePrismaStub({ failOn: ['acme.bare'] });

    const out = await upsertPluginNodeTypes(prisma, [bareManifest, richManifest]);

    expect(out).toEqual({ upserted: 1, failed: 1 });
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('writes the same shape to update + create so re-runs are idempotent', async () => {
    const { prisma, upsert } = makePrismaStub();
    await upsertPluginNodeTypes(prisma, [richManifest]);
    const args = upsert.mock.calls[0][0];
    // Every field on the data object lives on both branches.
    for (const key of [
      'category',
      'icon',
      'color',
      'label',
      'description',
      'inputs',
      'outputs',
      'properties',
    ]) {
      expect(args.update[key]).toEqual(args.create[key]);
    }
    // Only `type` and `tenantId` live on create alone.
    expect(args.update.type).toBeUndefined();
    expect(args.update.tenantId).toBeUndefined();
  });
});
