import { CodeExecutor } from '../../../runbook/executors/code.executor';
import type { Runner, RunnerResult, RunnerSpec } from '../../../runbook/runners/runner.types';

function fakeRunner(reply: (spec: RunnerSpec) => Partial<RunnerResult>) {
  const specs: RunnerSpec[] = [];
  const runner: Runner = {
    type: 'sandbox',
    run: async spec => {
      specs.push(spec);
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
        durationMs: 5,
        ...reply(spec),
      };
    },
  };
  return { runner, specs };
}

const ctx = {
  runId: 'r',
  stepId: 's',
  tenantId: 't',
  variables: { env: 'prod' },
  previousOutputs: { a: { output: 1 } },
};
const decode = (b64: string) => Buffer.from(b64, 'base64').toString();

describe('CodeExecutor', () => {
  it('passes code and input only through env and reads the marked result', async () => {
    const { runner, specs } = fakeRunner(spec => ({
      stdout: `hello\n\n${spec.env!.OPERARI_RESULT_MARK}{"ok":true}\n`,
    }));
    const res = await new CodeExecutor(runner).execute(
      { language: 'python', code: 'result = {"ok": True}' },
      ctx as never
    );
    expect(res).toMatchObject({ success: true, output: { result: { ok: true }, logs: 'hello' } });
    const spec = specs[0];
    expect(spec.image).toBe('python:3.12-alpine');
    expect(spec.network).toBe('none');
    expect(spec.command).not.toContain('result =');
    expect(decode(spec.env!.OPERARI_CODE_B64)).toBe('result = {"ok": True}');
    expect(JSON.parse(decode(spec.env!.OPERARI_INPUT_B64))).toEqual({
      a: { output: 1 },
      vars: { env: 'prod' },
    });
  });

  it('ignores a forged marker from another run and reports a missing result', async () => {
    const { runner } = fakeRunner(() => ({
      stdout: '__OPERARI_RESULT_0000000000000000__{"x":1}\n',
    }));
    const res = await new CodeExecutor(runner).execute(
      { language: 'javascript', code: 'return 1' },
      ctx as never
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no result/);
  });

  it('fails with the end of stderr on a non-zero exit and on timeout', async () => {
    const failing = fakeRunner(() => ({
      exitCode: 1,
      stderr: 'Traceback\n  File "step.py"\nValueError: boom',
    }));
    expect(
      (
        await new CodeExecutor(failing.runner).execute(
          { language: 'python', code: 'x' },
          ctx as never
        )
      ).error
    ).toMatch(/exited with 1 .*ValueError: boom/);
    const slow = fakeRunner(() => ({ exitCode: null, timedOut: true }));
    expect(
      (
        await new CodeExecutor(slow.runner).execute(
          { language: 'python', code: 'x', timeout: 10 },
          ctx as never
        )
      ).error
    ).toMatch(/timed out after 10ms/);
  });

  it('asks for internet only when the step opts in, and refuses bad config without running', async () => {
    const { runner, specs } = fakeRunner(spec => ({
      stdout: `${spec.env!.OPERARI_RESULT_MARK}null`,
    }));
    await new CodeExecutor(runner).execute(
      { language: 'javascript', code: 'return null', network: 'internet' },
      ctx as never
    );
    expect(specs[0]).toMatchObject({ network: 'open', image: 'node:20-alpine' });
    const exec = new CodeExecutor(runner);
    expect(
      (await exec.execute({ language: 'ruby' as never, code: 'x' }, ctx as never)).success
    ).toBe(false);
    expect((await exec.execute({ language: 'python', code: '  ' }, ctx as never)).success).toBe(
      false
    );
    const big = { ...ctx, previousOutputs: { blob: 'x'.repeat(200_000) } };
    expect((await exec.execute({ language: 'python', code: 'x' }, big as never)).error).toMatch(
      /over the 100000 limit/
    );
    expect(specs).toHaveLength(1);
  });
});
