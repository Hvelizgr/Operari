/**
 * RunChunkBuffer — in-memory accumulator for stdout / stderr chunks
 * POSTed by the Fly machine sidecar before the runner reads them at
 * finish-time.
 *
 * Why this exists:
 *   The Fly Machines API does not return run output inline. v1 of
 *   FlyMachineRunner returned the exit code only; v1.1 wraps the
 *   user command with a tiny tee script (see ops/fly-runner-tee.sh)
 *   that POSTs each line back to Operari. This buffer is the
 *   server-side counterpart — it accumulates the chunks per
 *   machineId and lets the runner drain them once the wait/state
 *   roundtrip confirms the machine is stopped.
 *
 * Why in-memory and not Redis (yet):
 *   - One Operari backend instance owns the lifecycle of any given
 *     Fly machine end-to-end (CREATE → WAIT → STATE → DELETE all
 *     happen on the same process). The buffer never needs to hop
 *     between instances.
 *   - The runner forces a hard timeout per spec, so a stale entry
 *     can sit in the map for at most that long. The forget() path
 *     covers cancellation; drain() covers happy path.
 *   - The maxBytesPerStream cap is the only memory protection
 *     needed: a runaway command can't blow the heap because each
 *     stream is truncated to a sliding window.
 *
 * Migration to Redis later is a single class swap — same interface.
 */

export type ChunkStream = 'stdout' | 'stderr';

export interface ChunkAppendInput {
  machineId: string;
  stream: ChunkStream;
  text: string;
}

export interface ChunkBufferState {
  stdout: string;
  stderr: string;
}

export interface RunChunkBufferOptions {
  /**
   * Per-stream cap. When the accumulated text would exceed this, we
   * keep the most recent `maxBytesPerStream` bytes and drop the head.
   * Default 1 MiB — generous for typical runbook output, small
   * enough that 100 concurrent runs cannot blow a 256 MB process.
   */
  maxBytesPerStream?: number;
}

export class RunChunkBuffer {
  private readonly buffers = new Map<string, ChunkBufferState>();
  private readonly maxBytes: number;

  constructor(options: RunChunkBufferOptions = {}) {
    this.maxBytes = options.maxBytesPerStream ?? 1_048_576;
  }

  append(input: ChunkAppendInput): void {
    const buf = this.buffers.get(input.machineId) ?? { stdout: '', stderr: '' };
    const next = buf[input.stream] + input.text;
    buf[input.stream] = next.length > this.maxBytes ? next.slice(-this.maxBytes) : next;
    this.buffers.set(input.machineId, buf);
  }

  /**
   * Read and remove the buffered chunks for a machine. Returns
   * empty strings when no chunks were seen — that's the normal case
   * for a runner image that doesn't ship the tee wrapper.
   */
  drain(machineId: string): ChunkBufferState {
    const buf = this.buffers.get(machineId) ?? { stdout: '', stderr: '' };
    this.buffers.delete(machineId);
    return buf;
  }

  /**
   * Drop any buffered chunks for a machine without reading. Used by
   * the cancel path so a force-destroyed machine does not leak
   * memory until the next happy-path drain (which never comes).
   */
  forget(machineId: string): void {
    this.buffers.delete(machineId);
  }

  /** Number of distinct machines currently holding chunks. Test-only signal. */
  get size(): number {
    return this.buffers.size;
  }
}
