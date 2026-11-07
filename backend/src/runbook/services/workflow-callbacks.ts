import { PrismaClient } from '@prisma/client';

import { WorkflowCallbackService } from './workflow-callback.service';

let instance: WorkflowCallbackService | null = null;

/** Lazy: ExecutionService builds the executor registry that holds this service. */
export function getWorkflowCallbacks(prisma: PrismaClient): WorkflowCallbackService {
  if (!instance) {
    instance = new WorkflowCallbackService(prisma, async params => {
      const { ExecutionService } = await import('../../editor/execution/execution.service');
      return new ExecutionService(prisma).resumeExecution(params);
    });
  }
  return instance;
}
