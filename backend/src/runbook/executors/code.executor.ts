import { randomBytes } from 'crypto';
import { extname } from 'path';

import { type FileRef, type FileStore, FileStoreError, isFileRef } from '../../files/file-store';
import type { Runner } from '../runners/runner.types';
import {
  type ExecutorContext,
  type ExecutorEvent,
  type ExecutorResult,
  resolveValue,
  type StepExecutor,
} from '../types/executor.types';
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
  /**
   * Files from earlier steps the code can read, as expressions separated by
   * commas or new lines, e.g. {{steps.download.output.file}}.
   */
  files?: string;
}

const IMAGES: Record<CodeConfig['language'], string> = {
  python: 'python:3.12-alpine',
  javascript: 'node:20-alpine',
};

// Values travel base64 in env vars of at most ENV_CHUNK characters (the
// sandbox protocol caps each one at 64 000): PREFIX_N says how many,
// PREFIX_0.. hold the pieces in order.
const PY_WRAPPER = `import base64, json, os, sys
def _env(p):
    return base64.b64decode("".join(os.environ[p + "_" + str(i)] for i in range(int(os.environ[p + "_N"]))))
files = json.loads(_env("OPERARI_FILES"))
_bytes = {f["id"]: base64.b64decode(f.pop("b64")) for f in files}
_out = []
def read_file(ref):
    key = ref.get("id") if isinstance(ref, dict) else ref
    if key not in _bytes:
        raise KeyError("file %r was not passed to this step; add it to Files" % (key,))
    return _bytes[key]
def write_file(name, data, mime_type=None):
    if isinstance(data, str):
        data = data.encode()
    _out.append({"name": str(name), "mimeType": mime_type, "b64": base64.b64encode(bytes(data)).decode()})
    return {"kind": "file", "pending": len(_out) - 1}
_ns = {"input": json.loads(_env("OPERARI_INPUT")), "files": files, "read_file": read_file, "write_file": write_file}
exec(compile(_env("OPERARI_CODE").decode(), "step.py", "exec"), _ns)
sys.stdout.flush()
print("\\n" + os.environ["OPERARI_RESULT_MARK"] + json.dumps({"result": _ns.get("result"), "files": _out}, default=str))
`;

const JS_WRAPPER = `const env = p => Buffer.from(Array.from({ length: Number(process.env[p + '_N']) }, (_, i) => process.env[p + '_' + i]).join(''), 'base64');
const files = JSON.parse(env('OPERARI_FILES').toString());
const bytes = new Map(files.map(f => { const b = Buffer.from(f.b64, 'base64'); delete f.b64; return [f.id, b]; }));
const out = [];
const readFile = ref => {
  const id = typeof ref === 'string' ? ref : ref && ref.id;
  if (!bytes.has(id)) throw new Error('file ' + JSON.stringify(id) + ' was not passed to this step; add it to Files');
  return bytes.get(id);
};
const writeFile = (name, data, mimeType) => {
  out.push({ name: String(name), mimeType: mimeType ?? null, b64: Buffer.from(data).toString('base64') });
  return { kind: 'file', pending: out.length - 1 };
};
const input = JSON.parse(env('OPERARI_INPUT').toString());
const code = env('OPERARI_CODE').toString();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const result = await new AsyncFunction('input', 'files', 'readFile', 'writeFile', code)(input, files, readFile, writeFile);
process.stdout.write('\\n' + process.env.OPERARI_RESULT_MARK + JSON.stringify({ result: result ?? null, files: out }) + '\\n');
`;

const ENV_CHUNK = 60_000;
const MAX_INPUT_FILE_BYTES = 768 * 1024;
const MAX_OUTPUT_FILES = 20;
const MAX_OUTPUT_FILE_BYTES = 10 * 1024 * 1024;

const MIME: Record<string, string> = {
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.html': 'text/html',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Splits a value into base64 env vars PREFIX_N, PREFIX_0, PREFIX_1… */
export function chunkedEnv(prefix: string, value: string | Buffer): Record<string, string> {
  const b64 = Buffer.from(value).toString('base64');
  const env: Record<string, string> = {};
  let n = 0;
  for (let i = 0; i < b64.length || n === 0; i += ENV_CHUNK) {
    env[`${prefix}_${n++}`] = b64.slice(i, i + ENV_CHUNK);
  }
  env[`${prefix}_N`] = String(n);
  return env;
}

interface PendingFile {
  name: string;
  mimeType: string | null;
  b64: string;
}

/** Replaces the placeholders write_file returned with the saved references. */
function withSavedFiles(value: unknown, saved: FileRef[]): unknown {
  if (Array.isArray(value)) return value.map(v => withSavedFiles(v, saved));
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  if (
    obj.kind === 'file' &&
    typeof obj.pending === 'number' &&
    Object.keys(obj).length === 2 &&
    saved[obj.pending]
  ) {
    return saved[obj.pending];
  }
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, withSavedFiles(v, saved)]));
}

/**
 * Forwards stdout to the step log up to the result marker. What follows the
 * marker (the result and any files, base64) is not log output.
 */
function logUntilMarker(
  mark: string,
  emit: ExecutorContext['emit']
): ExecutorContext['emit'] | undefined {
  if (!emit) return undefined;
  let held = '';
  let done = false;
  return (event: ExecutorEvent) => {
    if (event.type !== 'stdout') return emit(event);
    if (done) return;
    const text = held + event.text;
    const at = text.indexOf(mark);
    if (at >= 0) {
      done = true;
      if (at > 0) emit({ ...event, text: text.slice(0, at) });
      return;
    }
    // Hold back a tail that could be the start of a marker split across chunks.
    const keep = Math.min(text.length, mark.length - 1);
    held = text.slice(text.length - keep);
    const out = text.slice(0, text.length - keep);
    if (out) emit({ ...event, text: out });
  };
}

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

  constructor(
    private readonly runner: Runner,
    private readonly fileStore?: FileStore
  ) {}

  private async inputFiles(
    config: CodeConfig,
    context: ExecutorContext
  ): Promise<Array<FileRef & { b64: string }>> {
    const raw = (config.files ?? '').trim();
    if (!raw) return [];
    if (!this.fileStore) throw new FileStoreError('file storage is not available on this backend');
    const refs = new Map<string, FileRef>();
    for (const piece of raw
      .split(/[\n,]+/)
      .map(p => p.trim())
      .filter(Boolean)) {
      const value = resolveValue(piece, context);
      for (const item of Array.isArray(value) ? value : [value]) {
        if (!isFileRef(item)) {
          throw new FileStoreError(`"${piece}" is not a file from an earlier step`);
        }
        refs.set(item.id, item);
      }
    }
    const total = [...refs.values()].reduce((n, f) => n + f.size, 0);
    if (total > MAX_INPUT_FILE_BYTES) {
      throw new FileStoreError(
        `files add up to ${total} bytes, over the ${MAX_INPUT_FILE_BYTES} limit for the code step`
      );
    }
    const out: Array<FileRef & { b64: string }> = [];
    for (const ref of refs.values()) {
      const { ref: stored, data } = await this.fileStore.read(context.tenantId, ref.id);
      out.push({ ...stored, b64: data.toString('base64') });
    }
    return out;
  }

  private async saveOutputFiles(
    pending: PendingFile[],
    context: ExecutorContext
  ): Promise<FileRef[]> {
    if (pending.length === 0) return [];
    if (!this.fileStore) throw new FileStoreError('file storage is not available on this backend');
    if (pending.length > MAX_OUTPUT_FILES) {
      throw new FileStoreError(`wrote ${pending.length} files, over the ${MAX_OUTPUT_FILES} limit`);
    }
    const buffers = pending.map(f => Buffer.from(String(f.b64 ?? ''), 'base64'));
    const total = buffers.reduce((n, b) => n + b.length, 0);
    if (total > MAX_OUTPUT_FILE_BYTES) {
      throw new FileStoreError(
        `wrote ${total} bytes of files, over the ${MAX_OUTPUT_FILE_BYTES} limit`
      );
    }
    const saved: FileRef[] = [];
    for (const [i, f] of pending.entries()) {
      const name = String(f.name || `file-${i + 1}`);
      saved.push(
        await this.fileStore.save({
          tenantId: context.tenantId,
          executionId: context.runId,
          name,
          mimeType: f.mimeType || MIME[extname(name).toLowerCase()] || 'application/octet-stream',
          data: buffers[i],
        })
      );
    }
    return saved;
  }

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

    let inputFiles: Array<FileRef & { b64: string }>;
    try {
      inputFiles = await this.inputFiles(config, context);
    } catch (err) {
      return { success: false, error: `code: ${(err as Error).message}`, duration: 0 };
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
          ...chunkedEnv('OPERARI_CODE', config.code),
          ...chunkedEnv('OPERARI_INPUT', input),
          ...chunkedEnv('OPERARI_FILES', JSON.stringify(inputFiles)),
          OPERARI_RESULT_MARK: mark,
        },
      },
      {
        runId: context.runId,
        stepId: context.stepId,
        tenantId: context.tenantId,
        emit: logUntilMarker(mark, context.emit),
      }
    );

    const at = result.stdout.lastIndexOf(mark);
    const logs = (at >= 0 ? result.stdout.slice(0, at) : result.stdout).trimEnd();
    let value: unknown = null;
    let pending: PendingFile[] = [];
    let parseError: string | null = null;
    if (at >= 0) {
      const raw = result.stdout.slice(at + mark.length).split('\n')[0];
      try {
        const trailer = JSON.parse(raw) as { result?: unknown; files?: PendingFile[] };
        value = trailer.result ?? null;
        pending = Array.isArray(trailer.files) ? trailer.files : [];
      } catch {
        parseError = 'the result is not JSON-serialisable';
      }
    }
    const output: Record<string, unknown> = {
      result: value,
      logs,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };

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
    try {
      const saved = await this.saveOutputFiles(pending, context);
      if (saved.length) {
        output.result = withSavedFiles(value, saved);
        output.files = saved;
      }
    } catch (err) {
      return {
        success: false,
        error: `code: ${(err as Error).message}`,
        output,
        duration: result.durationMs,
      };
    }
    return { success: true, output, duration: result.durationMs };
  }
}
