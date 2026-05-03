import { resolveTemplate } from '../../../editor/nodes/_shared';

describe('resolveTemplate built-in helpers', () => {
  describe('$now', () => {
    it('renders an ISO-8601 timestamp', () => {
      const out = resolveTemplate('time={{$now}}', {});
      expect(out).toMatch(/^time=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('$now.iso is an alias for $now', () => {
      const a = resolveTemplate('{{$now}}', {});
      const b = resolveTemplate('{{$now.iso}}', {});
      // The two evaluations land at slightly different ms boundaries
      // but the date part must always match.
      expect(a.slice(0, 19)).toBe(b.slice(0, 19));
    });

    it('$now.unixMs is a numeric epoch milliseconds string', () => {
      const out = resolveTemplate('{{$now.unixMs}}', {});
      expect(out).toMatch(/^\d{13}$/);
    });

    it('$now.unixSec is a numeric epoch seconds string', () => {
      const out = resolveTemplate('{{$now.unixSec}}', {});
      expect(out).toMatch(/^\d{10}$/);
    });

    it('unknown $now subkey resolves to empty string', () => {
      expect(resolveTemplate('{{$now.bogus}}', {})).toBe('');
    });
  });

  describe('$env', () => {
    it('reads from process.env', () => {
      const prior = process.env.OPERARI_TEMPLATE_TEST;
      process.env.OPERARI_TEMPLATE_TEST = 'live';
      try {
        expect(resolveTemplate('env={{$env.OPERARI_TEMPLATE_TEST}}', {})).toBe('env=live');
      } finally {
        if (prior === undefined) delete process.env.OPERARI_TEMPLATE_TEST;
        else process.env.OPERARI_TEMPLATE_TEST = prior;
      }
    });

    it('renders empty string when the env var is unset', () => {
      delete process.env.OPERARI_TEMPLATE_DOES_NOT_EXIST;
      expect(resolveTemplate('{{$env.OPERARI_TEMPLATE_DOES_NOT_EXIST}}', {})).toBe('');
    });
  });

  describe('$workflow / $run (engine-injected)', () => {
    it('reads $workflow.id from a context the engine pre-populated', () => {
      // The engine writes `$workflow` and `$run` into the input under
      // reserved keys before invoking the executor — see
      // `getNodeInput` in execution.service.ts.
      const context = {
        $workflow: { id: 'rb-1', name: 'Deploy', slug: 'deploy' },
        $run: { id: 'exec-9', startedAt: '2026-05-03T20:00:00.000Z', trigger: 'MANUAL' },
      };
      expect(resolveTemplate('rb={{$workflow.id}}', context)).toBe('rb=rb-1');
      expect(resolveTemplate('name={{$workflow.name}}', context)).toBe('name=Deploy');
      expect(resolveTemplate('run={{$run.id}}', context)).toBe('run=exec-9');
      expect(resolveTemplate('trigger={{$run.trigger}}', context)).toBe('trigger=MANUAL');
    });

    it('resolves to empty string when the engine did not inject the ambient', () => {
      // Bare unit calls (tests, dispatcher rehearsal) pass {} —
      // helpers must degrade gracefully rather than throw.
      expect(resolveTemplate('{{$workflow.id}}', {})).toBe('');
      expect(resolveTemplate('{{$run.id}}', {})).toBe('');
    });
  });

  describe('regular paths still work', () => {
    it('does not interfere with non-$ paths', () => {
      const ctx = { user: { name: 'alice' }, count: 7 };
      expect(resolveTemplate('hi {{user.name}} ({{count}})', ctx)).toBe('hi alice (7)');
    });

    it('a context key that happens to start with $ is reachable via the same nested path', () => {
      // Authors sometimes pin a literal `$amount` key into their data.
      // The helper short-circuits ONLY for the documented prefixes
      // ($now, $env), so other $-keys still flow through getNestedValue.
      const ctx = { $amount: 42 };
      expect(resolveTemplate('{{$amount}}', ctx)).toBe('42');
    });
  });
});
