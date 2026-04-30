import { type ChildProcess, spawn } from 'child_process';
import readline from 'readline';

import { logger } from '../../config/logger.config';

/**
 * Python plugin bridge — spawn a Python subprocess, write the
 * config + context envelope to stdin, parse `EMIT` + `RESULT` lines
 * from stdout.
 *
 * The wire protocol is documented in the Python SDK at
 * `packages/python-sdk/src/operari/steps/ipc.py`. Three line shapes
 * on stdout:
 *
 *   EMIT {"type":"log","text":"..."}\n        — streamed log event
 *   RESULT {"success":true,"output":{...}}\n  — final step result
 *   <anything else>                            — raw output, captured
 *                                               for debugging, not
 *                                               surfaced as a log event
 *
 * Anything written to stderr is captured and, if non-empty, attached
 * to a failure result so a Python traceback shows up in the run
 * timeline instead of disappearing into the void.
 */

export interface PythonBridgeContext {
  runId: string;
  stepId: string;
  tenantId: string;
  variables: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  secrets: Record<string, string>;
  emit?: (event: { type: string; text: string }) => void;
}

export interface PythonBridgeResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface SpawnPythonStepOptions {
  /** Absolute path to the Python script that calls run_cli(step). */
  entry: string;
  /** Working directory for the subprocess. Plugin dir by default. */
  cwd: string;
  /**
   * Python binary to invoke. Defaults to OPERARI_PYTHON_BIN if set,
   * else `python3`. Operators with a venv-managed plugin dir can
   * point this at the venv's interpreter.
   */
  pythonBin?: string;
  /**
   * Hard timeout in milliseconds. Default 60s. The subprocess gets
   * SIGTERM + a 2s grace period, then SIGKILL.
   */
  timeoutMs?: number;
  /**
   * Extra env passed to the subprocess on top of the inherited
   * process.env. The runtime adds OPERARI_PLUGIN_TYPE so plugin
   * code can self-identify in logs.
   */
  env?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const SIGTERM_GRACE_MS = 2_000;

export function getDefaultPythonBin(): string {
  return process.env.OPERARI_PYTHON_BIN || 'python3';
}

/**
 * Run one invocation of a Python plugin step. Pure function over
 * `config + context → result` modulo the subprocess side-effects.
 */
export async function spawnPythonStep(
  config: unknown,
  context: PythonBridgeContext,
  options: SpawnPythonStepOptions
): Promise<PythonBridgeResult> {
  const pythonBin = options.pythonBin ?? getDefaultPythonBin();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const child: ChildProcess = spawn(pythonBin, [options.entry], {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
      // Buffered stdout from Python is the silent killer of streaming
      // log UX — `python -u` (unbuffered) has the same effect via env.
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const envelope = JSON.stringify({
    config,
    context: {
      runId: context.runId,
      stepId: context.stepId,
      tenantId: context.tenantId,
      variables: context.variables,
      previousOutputs: context.previousOutputs,
      secrets: context.secrets,
    },
  });

  child.stdin?.end(envelope);

  let parsedResult: PythonBridgeResult | null = null;
  const stderrBuf: string[] = [];

  // Wire stdout line-by-line so EMIT events stream live to the run
  // timeline instead of all arriving at process exit.
  if (child.stdout) {
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on('line', line => {
      if (line.startsWith('EMIT ')) {
        try {
          const event = JSON.parse(line.slice(5)) as { type?: unknown; text?: unknown };
          if (typeof event.type === 'string' && typeof event.text === 'string') {
            context.emit?.({ type: event.type, text: event.text });
          }
        } catch {
          // Malformed EMIT — drop silently; the rest of the stream
          // is still trustworthy.
        }
        return;
      }
      if (line.startsWith('RESULT ')) {
        try {
          const result = JSON.parse(line.slice(7)) as Record<string, unknown>;
          parsedResult = {
            success: Boolean(result.success),
            output: (result.output as Record<string, unknown> | undefined) ?? undefined,
            error: typeof result.error === 'string' ? result.error : undefined,
          };
        } catch (err) {
          // Treat a malformed RESULT line as a hard failure — the
          // contract is that exactly one parseable RESULT lands.
          parsedResult = {
            success: false,
            error: `python plugin: malformed RESULT line — ${err instanceof Error ? err.message : String(err)}`,
          };
        }
        return;
      }
      // Lines without a known prefix: raw output. Captured at debug
      // level so an operator tailing logs can spot accidental
      // print() calls without polluting the run timeline.
      logger.debug({ line, msg: 'python plugin: unprefixed stdout line' });
    });
  }

  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => stderrBuf.push(chunk));
  }

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, SIGTERM_GRACE_MS);
  }, timeoutMs);

  const exitCode: number | null = await new Promise(resolve => {
    child.once('close', code => resolve(code));
    child.once('error', () => resolve(null));
  });
  clearTimeout(timeout);

  if (timedOut) {
    return {
      success: false,
      error: `python plugin: timed out after ${timeoutMs}ms`,
    };
  }

  if (parsedResult) {
    // If execute() returned success but stderr had content, the
    // operator probably wants to know — surface it as a debug log
    // but trust the plugin's stated result.
    if (stderrBuf.length > 0) {
      logger.debug({
        msg: 'python plugin: stderr content alongside successful RESULT',
        stderr: stderrBuf.join('').slice(0, 4096),
      });
    }
    return parsedResult;
  }

  // No RESULT line — synthesize a failure that includes whatever the
  // Python side wrote to stderr (typically a traceback).
  const stderrText = stderrBuf.join('').trim();
  return {
    success: false,
    error: stderrText
      ? `python plugin: no RESULT emitted (exit ${exitCode}). stderr:\n${stderrText.slice(0, 4096)}`
      : `python plugin: no RESULT emitted (exit ${exitCode})`,
  };
}
