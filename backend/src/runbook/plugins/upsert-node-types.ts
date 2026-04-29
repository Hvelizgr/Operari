import type { Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../../config/logger.config';

import type { PluginNodeMetadata } from './loader';

/**
 * Upsert a NodeType row for every plugin discovered by the sync
 * loader. The bridge that lets a plugin step show up in the editor's
 * NodePalette and render an auto-form in PropertiesPanel — the same
 * way built-in steps do via the prisma seed.
 *
 * Globals only: tenantId is intentionally NULL. The SDK plugin path
 * today is filesystem-based (OPERARI_PLUGINS_DIR), which is global to
 * the deployment. Tenant-scoped plugin install (bring-your-own
 * .tar.gz per tenant) is a separate roadmap item; when it lands, the
 * caller passes a tenantId here and we upsert against the composite
 * (type, tenantId) key.
 *
 * Idempotent: the upsert keys on `type` so re-running on every boot
 * is safe. A plugin that bumped its version + changed properties
 * picks up the new shape on the next process start.
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
  manifests: PluginNodeMetadata[]
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

    try {
      await prisma.nodeType.upsert({
        where: { type: manifest.type },
        update: data,
        create: { type: manifest.type, tenantId: null, ...data },
      });
      upserted++;
    } catch (err) {
      failed++;
      logger.error({
        plugin: manifest.source,
        type: manifest.type,
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
