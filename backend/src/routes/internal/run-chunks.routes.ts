import crypto from 'crypto';

import { type Request, type Response, Router } from 'express';

import { logger } from '../../config/logger.config';
import type { RunChunkBuffer, ChunkStream } from '../../runbook/runners/run-chunk-buffer';

/**
 * Internal endpoint consumed by the Fly machine sidecar (see
 * `ops/fly-runner-tee.sh`). The runner spawned inside the
 * Firecracker microVM POSTs each line of the wrapped command's
 * stdout / stderr here, signed with HMAC-SHA256 over the raw body.
 *
 * The endpoint is NOT user-authenticated — the only auth signal is
 * the HMAC signature using `OPERARI_RUN_CHUNK_SECRET`. The same
 * secret is injected into the machine's env at create-time so the
 * wrapper can sign before posting. A leaked secret lets an attacker
 * forge log lines for any in-flight machine, but cannot escalate to
 * tenant data — the buffer is keyed on machineId only and the
 * runner blindly drains whatever's there.
 *
 * Response shape:
 *   - 204 on success
 *   - 400 on missing fields / invalid stream
 *   - 401 on missing or invalid signature
 *   - 503 when no shared secret is configured (sidecar disabled)
 *
 * Idempotency: the buffer appends, so a chunk replayed twice
 * shows up twice. The wrapper script does not retry on success —
 * each chunk is a fire-and-forget POST. If a chunk POST fails the
 * line is dropped from the buffer but still goes to Fly's own
 * stdio (the wrapper tees both directions). Operators see complete
 * output via Fly logs even when the sidecar misses chunks.
 */
export interface CreateRunChunksRouterOptions {
  buffer: RunChunkBuffer;
  /** HMAC shared secret. When empty, the endpoint refuses every request with 503. */
  secret: string;
}

const ALLOWED_STREAMS: readonly ChunkStream[] = ['stdout', 'stderr'];

interface ChunkBody {
  machineId?: unknown;
  stream?: unknown;
  text?: unknown;
}

export function createRunChunksRouter(options: CreateRunChunksRouterOptions): Router {
  const router = Router();
  const { buffer, secret } = options;

  router.post('/', (req: Request, res: Response) => {
    if (!secret) {
      // Sidecar feature disabled — return 503 so the wrapper script
      // can short-circuit on first failure and stop spamming.
      return res.status(503).json({ error: 'Run-chunk sidecar is not configured' });
    }

    const sigHeader = req.header('x-operari-sig');
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!verifyHmac(secret, rawBody, sigHeader)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const body = (req.body ?? {}) as ChunkBody;
    const machineId = typeof body.machineId === 'string' ? body.machineId.trim() : '';
    const stream = body.stream;
    const text = body.text;

    if (!machineId) {
      return res.status(400).json({ error: 'machineId is required' });
    }
    if (typeof stream !== 'string' || !ALLOWED_STREAMS.includes(stream as ChunkStream)) {
      return res.status(400).json({ error: 'stream must be "stdout" or "stderr"' });
    }
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'text must be a string' });
    }

    buffer.append({
      machineId,
      stream: stream as ChunkStream,
      text,
    });

    return res.status(204).end();
  });

  return router;
}

/**
 * Validate `X-Operari-Sig: hex(hmac-sha256(rawBody, secret))` using
 * a constant-time compare. Returns false on any malformed input —
 * never throws, so a malicious sender cannot force a 500.
 */
function verifyHmac(
  secret: string,
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader || rawBody === undefined || rawBody === null) return false;

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');

  let provided = signatureHeader.trim();
  if (provided.toLowerCase().startsWith('sha256=')) {
    provided = provided.substring(7);
  }
  if (expected.length !== provided.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    logger.debug({ headerLen: signatureHeader.length }, 'run-chunk hmac decode failed');
    return false;
  }
}
