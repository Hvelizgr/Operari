import type { Prisma, PrismaClient } from '@prisma/client';

import { ErrorCode, NodeExecutionError } from '../../errors/custom-error';
import type {
  ExecutionInput,
  SetMetadataNodeConfig,
  SetMetadataResult,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext } from './_shared';
import { resolveTemplate } from './_shared';

/**
 * SetMetadata node — merges a metadata payload into the current
 * Execution row. Used by runbooks that need to attach structured
 * context (release version, ticket id, …) to a run for downstream
 * filtering and reporting.
 *
 * Behavior preserved exactly from the legacy `executeSetMetadata`
 * method:
 *   - Throws NODE_EXECUTION_FAILED when metadata is missing
 *   - JSON-round-trips the metadata to resolve {{templates}} inside
 *     nested fields
 *   - Merges shallow into the existing Execution.metadata (later
 *     keys win), preserving any keys the SetMetadata payload does
 *     not mention
 *
 * Requires `executionId` from the dispatcher.
 */
export class SetMetadataNodeExecutor implements EditorNodeExecutor<
  SetMetadataNodeConfig,
  SetMetadataResult
> {
  readonly type = 'SetMetadata';

  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    config: SetMetadataNodeConfig,
    input: ExecutionInput,
    errorContext: NodeErrorContext,
    _tenantId?: string,
    executionId?: string
  ): Promise<SetMetadataResult> {
    if (!executionId) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Execution ID is required for SetMetadata operation',
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }

    const { metadata } = config;
    if (!metadata) {
      throw new NodeExecutionError({
        ...errorContext,
        message: 'Metadata is not defined for SetMetadata operation',
        userMessage: 'Metadata for the node is empty',
        code: ErrorCode.NODE_EXECUTION_FAILED,
      });
    }

    const resolvedMetadata = JSON.parse(resolveTemplate(JSON.stringify(metadata), input));

    const execution = await this.prisma.execution.findUnique({
      where: { id: executionId },
      select: { metadata: true },
    });

    const currentMetadata = (execution?.metadata as Record<string, unknown>) || {};
    const newMetadata = { ...currentMetadata, ...resolvedMetadata };

    await this.prisma.execution.update({
      where: { id: executionId },
      data: { metadata: newMetadata as Prisma.InputJsonValue },
    });

    return { success: true, metadata: newMetadata };
  }
}
