import { detectActiveStep } from '../EditorHelpDrawer';

describe('detectActiveStep', () => {
  it('returns null for empty / nullish input', () => {
    expect(detectActiveStep(null)).toBeNull();
    expect(detectActiveStep(undefined)).toBeNull();
    expect(detectActiveStep('')).toBeNull();
  });

  it('maps shell-family executors to the steps topic', () => {
    expect(detectActiveStep('shell')).toBe('steps');
    expect(detectActiveStep('kubectl')).toBe('steps');
    expect(detectActiveStep('ssh')).toBe('steps');
    expect(detectActiveStep('http')).toBe('steps');
    expect(detectActiveStep('operari.httpRequest')).toBe('steps');
    expect(detectActiveStep('database')).toBe('steps');
    expect(detectActiveStep('operari.database')).toBe('steps');
  });

  it('maps Loop / Switch / if to control-flow', () => {
    expect(detectActiveStep('Loop')).toBe('control-flow');
    expect(detectActiveStep('Iterator')).toBe('control-flow');
    expect(detectActiveStep('operari.loop')).toBe('control-flow');
    expect(detectActiveStep('Switch')).toBe('control-flow');
    expect(detectActiveStep('operari.if')).toBe('control-flow');
    expect(detectActiveStep('Condition')).toBe('control-flow');
  });

  it('maps approval / wait / Suspend to pauses', () => {
    expect(detectActiveStep('approval')).toBe('pauses');
    expect(detectActiveStep('wait')).toBe('pauses');
    expect(detectActiveStep('Suspend')).toBe('pauses');
  });

  it('maps notify / Email to notifications', () => {
    expect(detectActiveStep('notify')).toBe('notifications');
    expect(detectActiveStep('Email')).toBe('notifications');
  });

  it('maps runbook to composition', () => {
    expect(detectActiveStep('runbook')).toBe('composition');
  });

  it('returns null for unknown / future step types', () => {
    expect(detectActiveStep('Trigger')).toBeNull();
    expect(detectActiveStep('Webhook')).toBeNull();
    expect(detectActiveStep('Schedule')).toBeNull();
    expect(detectActiveStep('Frame')).toBeNull();
    expect(detectActiveStep('whatever-future-type')).toBeNull();
  });
});
