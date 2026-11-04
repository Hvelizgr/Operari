import type { PrismaClient } from '@prisma/client';

import type { Logger } from '../../../services/logger.service';
import type { StepExecutor } from '../../types/executor.types';
import type { FlatInputStep } from './_flat-input';
import type { EmailTransporterLike } from './_shared';
import { ConditionNodeExecutor } from './condition.executor';
import { DelayNodeExecutor } from './delay.executor';
import { EmailNodeExecutor } from './email.executor';
import { FrameNodeExecutor } from './frame.executor';
import { HttpNodeExecutor } from './http.executor';
import { JoinNodeExecutor } from './join-node.executor';
import { LoopNodeExecutor } from './loop.executor';
import { MultiplexNodeExecutor } from './multiplex-node.executor';
import { NoteNodeExecutor } from './note.executor';
import { RepeatNodeExecutor } from './repeat-node.executor';
import { SetMetadataNodeExecutor } from './set-metadata.executor';
import { ShellCommandNodeExecutor } from './shell-command.executor';
import { SplitNodeExecutor } from './split-node.executor';
import { StoreGetNodeExecutor } from './store-get.executor';
import { StoreSetNodeExecutor } from './store-set.executor';
import { SuspendNodeExecutor } from './suspend.executor';
import { SwitchNodeExecutor } from './switch.executor';
import { TransformNodeExecutor } from './transform.executor';
import { TriggerNodeExecutor } from './trigger.executor';

export { FlatInputStep, isFlatInputStep } from './_flat-input';

export interface CoreStepDeps {
  prisma: PrismaClient;
  logger: Logger;
  getEmailTransporter?: () => EmailTransporterLike | null;
  /** The shell step, looked up at call time so tests can swap it. */
  shell: () => StepExecutor | undefined;
}

/**
 * Flow control, data and state steps from the original editor (condition,
 * switch, loop, transform, store get/set, …), registered under their type
 * and every alias. A type already in the registry keeps its executor, so
 * native and catalog steps win (`operari.httpRequest` stays HttpExecutor).
 * Two core steps claiming the same type is a bug and throws.
 */
export function registerCoreSteps(registry: Map<string, StepExecutor>, deps: CoreStepDeps): void {
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: FlatInputStep<any>[] = [
    new DelayNodeExecutor(),
    new TransformNodeExecutor({ logger: deps.logger }),
    new ConditionNodeExecutor(),
    new SwitchNodeExecutor(),
    new NoteNodeExecutor(),
    new FrameNodeExecutor(),
    new HttpNodeExecutor({ logger: deps.logger }),
    new EmailNodeExecutor({
      logger: deps.logger,
      getEmailTransporter: deps.getEmailTransporter ?? (() => null),
    }),
    new TriggerNodeExecutor(),
    new LoopNodeExecutor(),
    new SuspendNodeExecutor(),
    new StoreSetNodeExecutor(deps.prisma),
    new StoreGetNodeExecutor(deps.prisma),
    new SetMetadataNodeExecutor(deps.prisma),
    new ShellCommandNodeExecutor({ logger: deps.logger }, deps.shell),
    new SplitNodeExecutor(),
    new JoinNodeExecutor(),
    new RepeatNodeExecutor(),
    new MultiplexNodeExecutor(),
  ];
  for (const step of steps) {
    for (const type of [step.type, ...(step.aliases ?? [])]) {
      if (seen.has(type)) {
        throw new Error(`Duplicate core step type registration: ${type} (${step.type})`);
      }
      seen.add(type);
      if (!registry.has(type)) registry.set(type, step);
    }
  }
}
