import type { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../../config/logger.config';

import type { PluginNodeMetadata } from './loader';

/**
 * Upsert a NodeType row for every plugin discovered by the sync
 * loader. The bridge that lets a plugin step show up in the editor's
 * NodePalette and render an auto-form in PropertiesPanel — the same
 * way built-in steps do via the prisma seed.
 *
 * Pass `tenantId = null` (default) for globally-installed plugins
 * (the OPERARI_PLUGINS_DIR filesystem path), or a tenant id for the
 * per-tenant install path served by /api/tenants/plugins. The
 * underlying schema's composite unique (type, tenantId) plus the
 * partial unique on type-where-tenantId-is-null keeps both spaces
 * collision-free.
 *
 * Idempotent: the upsert keys on (type, tenantId) so re-running on
 * every boot is safe. A plugin that bumped its version + changed
 * properties picks up the new shape on the next process start.
 *
 * Fail-safe: if the database is unreachable or a single upsert
 * throws, we log and continue. A broken DB connection at boot must
 * not prevent the runtime executor registry from serving runs — the
 * editor catalog is downstream of the runtime, not the other way.
 */
const DEFAULT_INPUTS = [{ name: 'main', type: 'main' }];
const DEFAULT_OUTPUTS = [{ name: 'main', type: 'main' }];

interface LocalizedString {
  en?: string;
  es?: string;
}

function normalizeLocalized(value: unknown, fallback: string): LocalizedString {
  if (typeof value === 'string') {
    return { en: value, es: value };
  }
  if (value && typeof value === 'object') {
    const v = value as { en?: unknown; es?: unknown };
    const en = typeof v.en === 'string' ? v.en : fallback;
    const es = typeof v.es === 'string' ? v.es : en;
    return { en, es };
  }
  return { en: fallback, es: fallback };
}

export async function upsertPluginNodeTypes(
  prisma: PrismaClient,
  manifests: PluginNodeMetadata[],
  tenantId: string | null = null
): Promise<{ upserted: number; failed: number }> {
  if (manifests.length === 0) {
    return { upserted: 0, failed: 0 };
  }

  let upserted = 0;
  let failed = 0;

  for (const manifest of manifests) {
    const label = normalizeLocalized(manifest.label, manifest.type);
    const description = normalizeLocalized(manifest.description, '');
    // Cast through Prisma.InputJsonValue: LocalizedString and the
    // arbitrary inputs/outputs/properties arrays satisfy the column's
    // Json shape, but Prisma's narrow generics demand the exact alias.
    const data = {
      category: manifest.category ?? 'custom',
      icon: manifest.icon ?? 'Plug',
      color: manifest.color ?? 'bg-purple-500',
      label: label as unknown as Prisma.InputJsonValue,
      description: description as unknown as Prisma.InputJsonValue,
      inputs: (manifest.inputs ?? DEFAULT_INPUTS) as unknown as Prisma.InputJsonValue,
      outputs: (manifest.outputs ?? DEFAULT_OUTPUTS) as unknown as Prisma.InputJsonValue,
      properties: (manifest.properties ?? []) as unknown as Prisma.InputJsonValue,
    };

    // Prisma 5.x rejects `null` inside compound `whereUniqueInput`
    // even when the column is nullable, so we hand-roll the upsert
    // via findFirst → update | create. Boot-time seeding runs in a
    // single process so the race between findFirst and create is
    // tolerable; the partial unique index on (type) WHERE tenantId
    // IS NULL catches accidental duplicate globals at the DB level
    // either way.
    try {
      const existing = await prisma.nodeType.findFirst({
        where: { type: manifest.type, tenantId },
        select: { id: true },
      });
      if (existing) {
        await prisma.nodeType.update({ where: { id: existing.id }, data });
      } else {
        await prisma.nodeType.create({ data: { type: manifest.type, tenantId, ...data } });
      }
      upserted++;
    } catch (err) {
      failed++;
      logger.error({
        plugin: manifest.source,
        type: manifest.type,
        tenantId,
        err: err instanceof Error ? err.message : String(err),
        msg: 'plugin_loader: NodeType upsert failed',
      });
    }
  }

  if (upserted > 0 || failed > 0) {
    logger.info({
      upserted,
      failed,
      msg: 'plugin_loader: node-type upsert summary',
    });
  }

  return { upserted, failed };
}
