import type { PrismaClient } from '@prisma/client';

import { ErrorCode, NodeExecutionError } from '../../errors/custom-error';
import type {
  ExecutionInput,
  ExecutionOutput,
  StoreGetNodeConfig,
} from '../../types/runbook.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { resolveTemplate } from './_shared';

/**
 * StoreGet node — reads a single key from a tenant-scoped StorageBucket
 * and merges it back into the input under the resolved key name.
 *
 * Behavior preserved exactly from the legacy `executeStoreGet` method:
 *   - Throws CONFIGURATION_ERROR when key is missing
 *   - Defaults bucket to "default"
 *   - Returns `null` for the key when the bucket does not exist or
 *     the key is unset (rather than throwing) so downstream conditions
 *     can branch on it
 *   - Resolves {{templates}} in bucketName and key
 *
 * Requires `tenantId` from the dispatcher.
 */
export class StoreGetNodeExecutor implements EditorNodeExecutor<
  StoreGetNodeConfig,
  ExecutionOutput
> {
  readonly type = 'StoreGet';

  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    config: StoreGetNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext,
    tenantId?: string
  ): Promise<ExecutionOutput> {
    if (!tenantId) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Tenant ID is required for storage operations',
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }

    const { bucketName = 'default', key } = config;
    if (!key) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Storage key is required for Get operation',
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }

    const resolvedBucketName = resolveTemplate(bucketName, input);
    const resolvedKey = resolveTemplate(key, input);

    const bucket = await this.prisma.storageBucket.findUnique({
      where: { tenantId_name: { tenantId, name: resolvedBucketName } },
    });

    if (!bucket) {
      return { ...input, [resolvedKey]: null };
    }

    const data = (bucket.data as Record<string, unknown>) || {};
    const value = data[resolvedKey] || null;

    return { ...input, [resolvedKey]: value };
  }
}
