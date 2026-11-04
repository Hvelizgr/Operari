import { randomBytes } from 'crypto';

import type { Runner } from '../runners/runner.types';
import type { ExecutorContext, ExecutorResult, StepExecutor } from '../types/executor.types';
import { localShellDenied } from './shell.executor';

export interface CodeConfig {
  language: 'python' | 'javascript';
  /**
   * Python: assign the value to pass on to `result`.
   * JavaScript: the body of an async function; `return` the value.
   * Both read `input`: run variables and earlier step outputs.
   */
  code: string;
  timeout?: number;
  network?: 'none' | 'internet';
}

const IMAGES: Record<CodeConfig['language'], string> = {
  python: 'python:3.12-alpine',
  javascript: 'node:20-alpine',
};

const PY_WRAPPER = `import base64, json, os, sys
_ns = {"input": json.loads(base64.b64decode(os.environ["OPERARI_INPUT_B64"]))}
_code = base64.b64decode(os.environ["OPERARI_CODE_B64"]).decode()
exec(compile(_code, "step.py", "exec"), _ns)
sys.stdout.flush()
print("\\n" + os.environ["OPERARI_RESULT_MARK"] + json.dumps(_ns.get("result"), default=str))
`;

const JS_WRAPPER = `const input = JSON.parse(Buffer.from(process.env.OPERARI_INPUT_B64, 'base64').toString());
const code = Buffer.from(process.env.OPERARI_CODE_B64, 'base64').toString();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const result = await new AsyncFunction('input', code)(input);
process.stdout.write('\\n' + process.env.OPERARI_RESULT_MARK + JSON.stringify(result ?? null) + '\\n');
`;

const MAX_INPUT_BYTES = 100_000;

/**
 * Runs a snippet of Python or JavaScript on the configured runner (the
 * sandbox in production). The user's code and input travel base64 in
 * environment variables and a fixed wrapper decodes them, so nothing the
 * user writes is ever spliced into the shell line. The value to pass on is
 * printed after a per-run marker; everything before it is the step's log.
 */
export class CodeExecutor implements StepExecutor<CodeConfig> {
  readonly type = 'operari.code';

  constructor(private readonly runner: Runner) {}

  async execute(config: CodeConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const denied = localShellDenied(this.runner, context.tenantId);
    if (denied) return { success: false, error: denied, duration: 0 };
    if (config.language !== 'python' && config.language !== 'javascript') {
      return { success: false, error: 'code: language must be python or javascript', duration: 0 };
    }
    if (typeof config.code !== 'string' || !config.code.trim()) {
      return { success: false, error: 'code: the step has no code', duration: 0 };
    }

    const input = JSON.stringify({ ...context.previousOutputs, vars: context.variables }) ?? '{}';
    if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
      return {
        success: false,
        error: `code: input is ${Buffer.byteLength(input)} bytes, over the ${MAX_INPUT_BYTES} limit; pass less data to this step`,
        duration: 0,
      };
    }

    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] would run ${config.language} (${config.code.length} chars)`,
        timestamp: new Date(),
      });
      return { success: true, output: { dryRun: true, result: null }, duration: 0 };
    }

    const mark = `__OPERARI_RESULT_${randomBytes(8).toString('hex')}__`;
    const python = config.language === 'python';
    const file = python ? '/tmp/operari-main.py' : '/tmp/operari-main.mjs';
    const result = await this.runner.run(
      {
        command: `printf '%s' "$OPERARI_WRAPPER_B64" | base64 -d > ${file} && exec ${python ? 'python3' : 'node'} ${file}`,
        shell: 'sh',
        image: IMAGES[config.language],
        timeoutMs: config.timeout ?? 60_000,
        network: config.network === 'internet' ? 'open' : 'none',
        env: {
          OPERARI_WRAPPER_B64: Buffer.from(python ? PY_WRAPPER : JS_WRAPPER).toString('base64'),
          OPERARI_CODE_B64: Buffer.from(config.code).toString('base64'),
          OPERARI_INPUT_B64: Buffer.from(input).toString('base64'),
          OPERARI_RESULT_MARK: mark,
        },
      },
      {
        runId: context.runId,
        stepId: context.stepId,
        tenantId: context.tenantId,
        emit: context.emit,
      }
    );

    const at = result.stdout.lastIndexOf(mark);
    const logs = (at >= 0 ? result.stdout.slice(0, at) : result.stdout).trimEnd();
    let value: unknown = null;
    let parseError: string | null = null;
    if (at >= 0) {
      const raw = result.stdout.slice(at + mark.length).split('\n')[0];
      try {
        value = JSON.parse(raw);
      } catch {
        parseError = 'the result is not JSON-serialisable';
      }
    }
    const output = { result: value, logs, stderr: result.stderr, exitCode: result.exitCode };

    if (result.timedOut) {
      return {
        success: false,
        error: `code: timed out after ${config.timeout ?? 60_000}ms`,
        output,
        duration: result.durationMs,
      };
    }
    if (result.exitCode !== 0) {
      const tail = result.stderr.trim().split('\n').slice(-3).join(' | ');
      return {
        success: false,
        error: `code: exited with ${result.exitCode}${tail ? ` — ${tail}` : ''}`,
        output,
        duration: result.durationMs,
      };
    }
    if (at < 0 || parseError) {
      return {
        success: false,
        error: `code: ${parseError ?? 'no result was produced'}`,
        output,
        duration: result.durationMs,
      };
    }
    return { success: true, output, duration: result.durationMs };
  }
}
