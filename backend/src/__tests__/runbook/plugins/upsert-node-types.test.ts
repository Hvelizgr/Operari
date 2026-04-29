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
  findFirst: jest.Mock;
  update: jest.Mock;
  create: jest.Mock;
} {
  const failures = new Set(opts.failOn ?? []);
  const findFirst = jest.fn(async () => null);
  const update = jest.fn(async () => undefined);
  const create = jest.fn(async (args: { data: { type: string } }) => {
    if (failures.has(args.data.type)) {
      throw new Error(`db down for ${args.data.type}`);
    }
    return undefined;
  });
  const prisma = {
    nodeType: { findFirst, update, create },
  } as unknown as PrismaClient;
  return { prisma, findFirst, update, create };
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
    const { prisma, create } = makePrismaStub();
    const out = await upsertPluginNodeTypes(prisma, []);
    expect(out).toEqual({ upserted: 0, failed: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it('round-trips rich metadata onto the create payload (when no existing row)', async () => {
    const { prisma, create } = makePrismaStub();

    const out = await upsertPluginNodeTypes(prisma, [richManifest]);

    expect(out).toEqual({ upserted: 1, failed: 0 });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.data.type).toBe('acme.slack-notify');
    expect(args.data.tenantId).toBeNull();
    expect(args.data.icon).toBe('Send');
    expect(args.data.category).toBe('integrations');
    expect(args.data.label).toEqual({ en: 'Slack notify', es: 'Notificar Slack' });
    expect(Array.isArray(args.data.properties)).toBe(true);
    expect(args.data.properties).toHaveLength(2);
  });

  it('fills sensible defaults for a bare manifest', async () => {
    const { prisma, create } = makePrismaStub();

    await upsertPluginNodeTypes(prisma, [bareManifest]);

    const args = create.mock.calls[0][0];
    expect(args.data.icon).toBe('Plug');
    expect(args.data.color).toBe('bg-purple-500');
    expect(args.data.category).toBe('custom');
    expect(args.data.inputs).toEqual([{ name: 'main', type: 'main' }]);
    expect(args.data.outputs).toEqual([{ name: 'main', type: 'main' }]);
    expect(args.data.properties).toEqual([]);
    expect(args.data.label).toEqual({ en: 'acme.bare', es: 'acme.bare' });
  });

  it('coerces a plain-string label into both en + es', async () => {
    const { prisma, create } = makePrismaStub();
    await upsertPluginNodeTypes(prisma, [{ ...bareManifest, label: 'Just a string' }]);
    const args = create.mock.calls[0][0];
    expect(args.data.label).toEqual({ en: 'Just a string', es: 'Just a string' });
  });

  it('continues after a failing create and reports counts', async () => {
    const { prisma, create } = makePrismaStub({ failOn: ['acme.bare'] });

    const out = await upsertPluginNodeTypes(prisma, [bareManifest, richManifest]);

    expect(out).toEqual({ upserted: 1, failed: 1 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('uses update path when the row already exists (idempotent re-run)', async () => {
    const { prisma, findFirst, update, create } = makePrismaStub();
    findFirst.mockResolvedValueOnce({ id: 'existing-id' });

    await upsertPluginNodeTypes(prisma, [richManifest]);

    expect(update).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    const args = update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'existing-id' });
    expect(args.data.icon).toBe('Send');
  });

  it('threads tenantId into both findFirst and create when called per-tenant', async () => {
    const { prisma, findFirst, create } = makePrismaStub();
    await upsertPluginNodeTypes(prisma, [richManifest], 'tenant-42');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'acme.slack-notify', tenantId: 'tenant-42' } })
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-42' }) })
    );
  });
});
