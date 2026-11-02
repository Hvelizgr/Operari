import { spawn as nodeSpawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client, type ClientChannel, type ConnectConfig } from 'ssh2';

import { fingerprintOf, parseHostKey } from './host-key';

export interface SshRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface SshStreams {
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  onConnected?: () => void;
}

export interface Ssh2Target {
  host: string;
  port: number;
  username: string;
  privateKey: string;
  /** Pinned "type base64" host key. Omitted only for legacy ad-hoc steps. */
  hostKey?: string;
}

export class HostKeyMismatchError extends Error {
  constructor(expected: string, got: string) {
    super(`host key mismatch: expected ${expected}, server presented ${got}`);
    this.name = 'HostKeyMismatchError';
  }
}

/**
 * Runs one command over ssh2. With `hostKey` set, the handshake aborts
 * unless the server presents exactly that key.
 */
export function runOverSsh2(
  target: Ssh2Target,
  command: string,
  options: {
    env?: Record<string, string>;
    timeoutMs: number;
    createClient?: () => Client;
    register?: (client: Client) => void;
  } & SshStreams
): Promise<SshRunResult> {
  const client = (options.createClient ?? (() => new Client()))();
  options.register?.(client);
  const pinned = target.hostKey ? parseHostKey(target.hostKey) : null;
  let mismatch: HostKeyMismatchError | null = null;

  const config: ConnectConfig = {
    host: target.host,
    port: target.port,
    username: target.username,
    privateKey: target.privateKey,
    readyTimeout: Math.min(options.timeoutMs, 20_000),
  };
  if (pinned) {
    config.hostVerifier = (key: Buffer) => {
      if (Buffer.isBuffer(key) && key.equals(pinned.blob)) return true;
      const got = Buffer.isBuffer(key) ? fingerprintOf(key) : 'unknown';
      mismatch = new HostKeyMismatchError(pinned.fingerprint, got);
      return false;
    };
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let channel: ClientChannel | null = null;

    const timer = setTimeout(() => {
      timedOut = true;
      channel?.close();
      client.end();
      resolve({ stdout, stderr, exitCode: null, timedOut });
    }, options.timeoutMs);

    client.on('ready', () => {
      options.onConnected?.();
      client.exec(command, { env: options.env }, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          client.end();
          return reject(err);
        }
        channel = stream;
        stream.on('data', (data: Buffer) => {
          const text = data.toString();
          stdout += text;
          options.onStdout?.(text);
        });
        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          stderr += text;
          options.onStderr?.(text);
        });
        stream.on('close', (code: number | null) => {
          clearTimeout(timer);
          client.end();
          resolve({ stdout, stderr, exitCode: code, timedOut });
        });
      });
    });

    client.on('error', err => {
      clearTimeout(timer);
      client.end();
      reject(mismatch ?? new Error(`SSH connection failed: ${err.message}`));
    });

    client.connect(config);
  });
}

export type SpawnFn = (
  command: string,
  args: string[],
  options: { stdio: ['ignore', 'pipe', 'pipe']; env: Record<string, string> }
) => {
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  on(event: 'close', listener: (code: number | null) => void): unknown;
  on(event: 'error', listener: (err: Error) => void): unknown;
  kill(signal?: string): unknown;
};

export interface OpenSshTarget {
  host: string;
  port: number;
  username: string;
  hostKey: string;
  /** OpenSSH private key and its certificate, written to a 0700 temp dir. */
  privateKey: string;
  certificate: string;
}

const ALIAS = 'operari-server';

/**
 * Runs one command with the system OpenSSH client. Used for certificate
 * auth, which ssh2 does not implement. The host key is pinned through a
 * one-line known_hosts and strict checking; nothing from ~/.ssh is read.
 */
export function runOverOpenSsh(
  target: OpenSshTarget,
  command: string,
  options: {
    env?: Record<string, string>;
    timeoutMs: number;
    spawn?: SpawnFn;
    register?: (kill: () => void) => void;
  } & SshStreams
): Promise<SshRunResult> {
  const pinned = parseHostKey(target.hostKey);
  const dir = mkdtempSync(join(tmpdir(), 'operari-ssh-'));
  const keyPath = join(dir, 'id');
  const certPath = join(dir, 'id-cert.pub');
  const knownHosts = join(dir, 'known_hosts');
  writeFileSync(
    keyPath,
    target.privateKey.endsWith('\n') ? target.privateKey : target.privateKey + '\n',
    {
      mode: 0o600,
    }
  );
  writeFileSync(certPath, target.certificate.trim() + '\n', { mode: 0o600 });
  writeFileSync(knownHosts, `${ALIAS} ${pinned.line}\n`, { mode: 0o600 });

  const args = [
    '-F',
    '/dev/null',
    '-i',
    keyPath,
    '-o',
    `CertificateFile=${certPath}`,
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'IdentityAgent=none',
    '-o',
    `UserKnownHostsFile=${knownHosts}`,
    '-o',
    'GlobalKnownHostsFile=/dev/null',
    '-o',
    `HostKeyAlias=${ALIAS}`,
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=15',
    '-o',
    'ForwardAgent=no',
    '-o',
    'ClearAllForwardings=yes',
  ];
  for (const [k, v] of Object.entries(options.env ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || /[\r\n"]/.test(v)) {
      rmSync(dir, { recursive: true, force: true });
      return Promise.reject(new Error(`invalid env var for ssh: ${k}`));
    }
    args.push('-o', `SetEnv=${k}="${v}"`);
  }
  args.push('-p', String(target.port), '-l', target.username, '--', target.host, command);

  const spawn = options.spawn ?? (nodeSpawn as unknown as SpawnFn);
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let connected = false;
    const cleanup = () => rmSync(dir, { recursive: true, force: true });
    let proc: ReturnType<SpawnFn>;
    try {
      proc = spawn('ssh', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dir },
      });
    } catch (err) {
      cleanup();
      return reject(err);
    }
    options.register?.(() => proc.kill('SIGKILL'));
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, options.timeoutMs);
    proc.stdout.on('data', (chunk: Buffer) => {
      if (!connected) {
        connected = true;
        options.onConnected?.();
      }
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options.onStderr?.(text);
    });
    proc.on('error', err => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    proc.on('close', code => {
      clearTimeout(timer);
      cleanup();
      if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/.test(stderr)) {
        return reject(new HostKeyMismatchError(pinned.fingerprint, 'a different key'));
      }
      // 255 is ssh's own failure (connect/auth), not the remote command's.
      if (code === 255 && !connected && !timedOut) {
        return reject(
          new Error(`SSH connection failed: ${stderr.trim().split('\n').pop() ?? 'exit 255'}`)
        );
      }
      resolve({ stdout, stderr, exitCode: timedOut ? null : code, timedOut });
    });
  });
}
