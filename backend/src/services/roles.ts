import type { SchedulerLeader } from './scheduler-leader';

/**
 * Pure function: which background roles is this pod carrying?
 *
 * Exists as a standalone module so /health/roles stays a 3-line
 * handler and the test can assert every state combination without
 * standing up the whole server.
 */

export interface RolesSnapshot {
  scheduler: 'leader' | 'follower' | 'disabled';
  billingDispatch: 'enabled' | 'disabled';
}

export function computeRoles(input: {
  schedulerLeader: SchedulerLeader | null;
  billingProvider: string | undefined;
}): RolesSnapshot {
  const scheduler: RolesSnapshot['scheduler'] =
    input.schedulerLeader === null
      ? 'disabled'
      : input.schedulerLeader.isLeader()
        ? 'leader'
        : 'follower';

  const billingDispatch: RolesSnapshot['billingDispatch'] =
    (input.billingProvider ?? 'noop').toLowerCase() === 'stripe' ? 'enabled' : 'disabled';

  return { scheduler, billingDispatch };
}
