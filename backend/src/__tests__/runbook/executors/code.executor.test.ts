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
const joined = (env: Record<string, string>, prefix: string) =>
  Buffer.from(
    Array.from({ length: Number(env[`${prefix}_N`]) }, (_, i) => env[`${prefix}_${i}`]).join(''),
    'base64'
  ).toString();
const trailer = (spec: RunnerSpec, body: unknown) =>
  `${spec.env!.OPERARI_RESULT_MARK}${JSON.stringify(body)}\n`;

describe('CodeExecutor', () => {
  it('passes code and input only through env and reads the marked result', async () => {
    const { runner, specs } = fakeRunner(spec => ({
      stdout: `hello\n\n${trailer(spec, { result: { ok: true }, files: [] })}`,
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
    expect(joined(spec.env!, 'OPERARI_CODE')).toBe('result = {"ok": True}');
    expect(JSON.parse(joined(spec.env!, 'OPERARI_INPUT'))).toEqual({
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
      stdout: trailer(spec, { result: null, files: [] }),
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

  it('splits large input into env chunks the sandbox protocol accepts', async () => {
    const { runner, specs } = fakeRunner(spec => ({ stdout: trailer(spec, { result: 1 }) }));
    const big = { ...ctx, previousOutputs: { blob: 'x'.repeat(90_000) } };
    const res = await new CodeExecutor(runner).execute(
      { language: 'python', code: 'result = 1' },
      big as never
    );
    expect(res.success).toBe(true);
    const env = specs[0].env!;
    expect(Number(env.OPERARI_INPUT_N)).toBeGreaterThan(1);
    expect(Math.max(...Object.values(env).map(v => v.length))).toBeLessThanOrEqual(64_000);
    expect(JSON.parse(joined(env, 'OPERARI_INPUT')).blob).toHaveLength(90_000);
  });

  it('keeps the result trailer out of the step log, even split across chunks', async () => {
    const events: string[] = [];
    const runner: Runner = {
      type: 'sandbox',
      run: async (spec, rc) => {
        const mark = spec.env!.OPERARI_RESULT_MARK;
        const full = `line one\n${mark}{"result":2,"files":[{"name":"a","b64":"QUFB"}]}\n`;
        const cut = full.indexOf(mark) + 5;
        rc.emit?.({ type: 'stdout', text: full.slice(0, cut) });
        rc.emit?.({ type: 'stdout', text: full.slice(cut) });
        return { exitCode: 0, stdout: full, stderr: '', timedOut: false, durationMs: 1 };
      },
    };
    const save = jest.fn(async (f: { name: string; mimeType: string; data: Buffer }) => ({
      kind: 'file' as const,
      id: 'f1',
      name: f.name,
      mimeType: f.mimeType,
      size: f.data.length,
      sha256: 'x',
    }));
    await new CodeExecutor(runner, { save } as never).execute({ language: 'python', code: 'x' }, {
      ...ctx,
      emit: (e: { text: string }) => events.push(e.text),
    } as never);
    expect(events.join('')).toBe('line one\n');
  });

  it('passes chosen files in and saves the files the code writes', async () => {
    const ref = {
      kind: 'file',
      id: 'in-1',
      name: 'data.csv',
      mimeType: 'text/csv',
      size: 3,
      sha256: 'h',
    };
    const store = {
      read: jest.fn(async () => ({ ref, data: Buffer.from('a,b') })),
      save: jest.fn(async (f: { name: string; mimeType: string; data: Buffer }) => ({
        kind: 'file' as const,
        id: `out-${f.name}`,
        name: f.name,
        mimeType: f.mimeType,
        size: f.data.length,
        sha256: 'x',
      })),
    };
    const { runner, specs } = fakeRunner(spec => ({
      stdout: trailer(spec, {
        result: { report: { kind: 'file', pending: 0 }, rows: 1 },
        files: [
          { name: 'report.csv', mimeType: null, b64: Buffer.from('x,y').toString('base64') },
          { name: 'raw.bin', mimeType: 'application/x-raw', b64: 'AAE=' },
        ],
      }),
    }));
    const res = await new CodeExecutor(runner, store as never).execute(
      { language: 'python', code: 'x', files: '{{steps.dl.output.file}}' },
      { ...ctx, previousOutputs: { dl: { output: { file: ref } } } } as never
    );
    expect(res.success).toBe(true);
    const sent = JSON.parse(joined(specs[0].env!, 'OPERARI_FILES'));
    expect(sent).toEqual([{ ...ref, b64: Buffer.from('a,b').toString('base64') }]);
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'report.csv', mimeType: 'text/csv', executionId: 'r' })
    );
    expect(store.save.mock.calls[1][0]).toMatchObject({ mimeType: 'application/x-raw' });
    expect(res.output).toMatchObject({
      result: { report: { kind: 'file', id: 'out-report.csv' }, rows: 1 },
      files: [{ id: 'out-report.csv' }, { id: 'out-raw.bin' }],
    });
  });

  it('refuses a files entry that is not a file, and too many output files', async () => {
    const { runner, specs } = fakeRunner(spec => ({
      stdout: trailer(spec, {
        result: null,
        files: Array.from({ length: 21 }, (_, i) => ({ name: `f${i}`, b64: '' })),
      }),
    }));
    const store = { read: jest.fn(), save: jest.fn() };
    const exec = new CodeExecutor(runner, store as never);
    const notFile = await exec.execute(
      { language: 'python', code: 'x', files: '{{vars.env}}' },
      ctx as never
    );
    expect(notFile.error).toMatch(/not a file from an earlier step/);
    expect(specs).toHaveLength(0);
    const many = await exec.execute({ language: 'python', code: 'x' }, ctx as never);
    expect(many.error).toMatch(/over the 20 limit/);
    expect(store.save).not.toHaveBeenCalled();
  });
});
