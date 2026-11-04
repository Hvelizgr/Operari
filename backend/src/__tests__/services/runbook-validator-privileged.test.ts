import { RunbookValidatorService } from '../../services/runbook-validator.service';
import type { WorkflowDefinition } from '../../types/runbook.types';

const node = (id: string, type: string, config: Record<string, unknown> = {}) => ({
  id,
  type,
  title: id,
  position: { x: 0, y: 0 },
  config,
});
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });

function runbook(
  nodes: ReturnType<typeof node>[],
  edges: Array<[string, string]>
): WorkflowDefinition {
  return {
    name: 'r',
    nodes,
    connections: edges.map(([s, t]) => edge(s, t)),
  } as unknown as WorkflowDefinition;
}

const privilegedErrors = (def: WorkflowDefinition, required?: number) =>
  new RunbookValidatorService()
    .validate(def, { privilegedApprovals: required })
    .issues.filter(i => i.field === 'privileged');

describe('privileged ssh validation', () => {
  const trigger = node('trigger', 'manual');
  const sudo = node('sudo', 'ssh', { privileged: true, serverId: 's', command: 'reboot' });

  it('accepts an approval on the only path', () => {
    const def = runbook(
      [trigger, node('ok', 'approval'), sudo],
      [
        ['trigger', 'ok'],
        ['ok', 'sudo'],
      ]
    );
    expect(privilegedErrors(def)).toEqual([]);
  });

  it('rejects a privileged step with no approval before it', () => {
    const def = runbook([trigger, sudo], [['trigger', 'sudo']]);
    expect(privilegedErrors(def)).toHaveLength(1);
  });

  it('rejects a side path that skips the approval', () => {
    const def = runbook(
      [trigger, node('ok', 'approval'), node('shortcut', 'shell'), sudo],
      [
        ['trigger', 'ok'],
        ['ok', 'sudo'],
        ['trigger', 'shortcut'],
        ['shortcut', 'sudo'],
      ]
    );
    expect(privilegedErrors(def)).toHaveLength(1);
  });

  it('does not count a disabled approval', () => {
    const def = runbook(
      [trigger, { ...node('ok', 'approval'), enabled: false } as any, sudo],
      [
        ['trigger', 'ok'],
        ['ok', 'sudo'],
      ]
    );
    expect(privilegedErrors(def)).toHaveLength(1);
  });

  it('requires two approvals in series when the policy asks for two', () => {
    const one = runbook(
      [trigger, node('a1', 'approval'), sudo],
      [
        ['trigger', 'a1'],
        ['a1', 'sudo'],
      ]
    );
    expect(privilegedErrors(one, 2)[0].message).toMatch(/needs 2 approval steps/);
    const two = runbook(
      [trigger, node('a1', 'approval'), node('a2', 'approval'), sudo],
      [
        ['trigger', 'a1'],
        ['a1', 'a2'],
        ['a2', 'sudo'],
      ]
    );
    expect(privilegedErrors(two, 2)).toEqual([]);
  });

  it('ignores non-privileged ssh steps', () => {
    const def = runbook(
      [trigger, node('plain', 'ssh', { serverId: 's', command: 'uptime' })],
      [['trigger', 'plain']]
    );
    expect(privilegedErrors(def)).toEqual([]);
  });
});
