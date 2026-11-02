import { createHash } from 'crypto';
import { Client } from 'ssh2';

/** OpenSSH-style `SHA256:<base64, no padding>` fingerprint of a raw key blob. */
export function fingerprintOf(blob: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
}

function keyTypeOf(blob: Buffer): string {
  if (blob.length < 4) throw new Error('host key blob too short');
  const len = blob.readUInt32BE(0);
  if (len === 0 || len > 64 || blob.length < 4 + len) throw new Error('malformed host key blob');
  return blob.subarray(4, 4 + len).toString('ascii');
}

export interface ParsedHostKey {
  type: string;
  blob: Buffer;
  /** Canonical "type base64" line, without a comment. */
  line: string;
  fingerprint: string;
}

const KEY_TYPES = new Set([
  'ssh-ed25519',
  'ssh-rsa',
  'ecdsa-sha2-nistp256',
  'ecdsa-sha2-nistp384',
  'ecdsa-sha2-nistp521',
  'sk-ssh-ed25519@openssh.com',
  'sk-ecdsa-sha2-nistp256@openssh.com',
]);

export function parseHostKey(line: string): ParsedHostKey {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) throw new Error('expected "<type> <base64>"');
  const [type, b64] = parts;
  if (!KEY_TYPES.has(type)) throw new Error(`unsupported host key type: ${type}`);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error('host key is not base64');
  const blob = Buffer.from(b64, 'base64');
  if (keyTypeOf(blob) !== type) throw new Error('host key type does not match its blob');
  return {
    type,
    blob,
    line: `${type} ${blob.toString('base64')}`,
    fingerprint: fingerprintOf(blob),
  };
}

export function hostKeyFromBlob(blob: Buffer): ParsedHostKey {
  return parseHostKey(`${keyTypeOf(blob)} ${blob.toString('base64')}`);
}

/**
 * Connects far enough to receive the server's host key, then aborts:
 * nothing is authenticated and no command runs. The admin confirms the
 * fingerprint out of band before it is pinned.
 */
export function scanHostKey(
  host: string,
  port: number,
  createClient: () => Client = () => new Client(),
  timeoutMs = 10_000
): Promise<ParsedHostKey> {
  return new Promise((resolve, reject) => {
    const client = createClient();
    let captured: ParsedHostKey | null = null;
    let settled = false;
    const done = (err: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.end();
      if (captured) resolve(captured);
      else reject(err ?? new Error('no host key received'));
    };
    const timer = setTimeout(() => done(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
    client.on('error', err => done(captured ? null : new Error(`ssh: ${err.message}`)));
    client.on('close', () => done(null));
    client.connect({
      host,
      port,
      username: 'operari-scan',
      readyTimeout: timeoutMs,
      hostVerifier: (key: Buffer) => {
        try {
          captured = hostKeyFromBlob(key);
        } catch (err) {
          done(err as Error);
        }
        setImmediate(() => done(null));
        return false;
      },
    });
  });
}
