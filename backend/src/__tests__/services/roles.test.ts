process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import { computeRoles } from '../../services/roles';
import type { SchedulerLeader } from '../../services/scheduler-leader';

function leaderStub(isLeader: boolean): SchedulerLeader {
  return {
    isLeader: () => isLeader,
  } as unknown as SchedulerLeader;
}

describe('computeRoles', () => {
  it("scheduler='disabled' when schedulerLeader is null (SCHEDULER_LEADER_DISABLE=true)", () => {
    const snap = computeRoles({ schedulerLeader: null, billingProvider: 'noop' });
    expect(snap.scheduler).toBe('disabled');
  });

  it("scheduler='leader' when this pod holds the advisory lock", () => {
    const snap = computeRoles({ schedulerLeader: leaderStub(true), billingProvider: 'noop' });
    expect(snap.scheduler).toBe('leader');
  });

  it("scheduler='follower' when another pod holds the lock", () => {
    const snap = computeRoles({ schedulerLeader: leaderStub(false), billingProvider: 'noop' });
    expect(snap.scheduler).toBe('follower');
  });

  it("billingDispatch='enabled' when provider=stripe (case-insensitive)", () => {
    expect(computeRoles({ schedulerLeader: null, billingProvider: 'stripe' }).billingDispatch).toBe(
      'enabled'
    );
    expect(computeRoles({ schedulerLeader: null, billingProvider: 'STRIPE' }).billingDispatch).toBe(
      'enabled'
    );
  });

  it("billingDispatch='disabled' when provider=noop or unset", () => {
    expect(computeRoles({ schedulerLeader: null, billingProvider: 'noop' }).billingDispatch).toBe(
      'disabled'
    );
    expect(
      computeRoles({ schedulerLeader: null, billingProvider: undefined }).billingDispatch
    ).toBe('disabled');
  });

  it("billingDispatch='disabled' for unknown providers (defensive)", () => {
    expect(computeRoles({ schedulerLeader: null, billingProvider: 'orb' }).billingDispatch).toBe(
      'disabled'
    );
  });
});
