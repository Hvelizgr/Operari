import { generateKeyPairSync } from 'crypto';
import { EventEmitter } from 'events';

import { DEFAULT_POLICY, type TenantPolicy } from '../../policy/tenant-policy';
import { SSHExecutor } from '../../runbook/executors/ssh.executor';
import type { ExecutorContext } from '../../runbook/types/executor.types';
import { fingerprintOf, hostKeyFromBlob, parseHostKey, scanHostKey } from '../../servers/host-key';
import type { ServerDirectory, ServerRecord } from '../../servers/server-directory';

jest.mock('../../security/ssrf-guard', () => ({ blockedTarget: async () => null }));

function sshString(buf: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(buf.length);
  return Buffer.concat([len, buf]);
}

function ed25519Blob(): Buffer {
  const { publicKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x as string, 'base64url');
  return Buffer.concat([sshString(Buffer.from('ssh-ed25519')), sshString(raw)]);
}

const PINNED = ed25519Blob();
const OTHER = ed25519Blob();

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
  close() {}
}

/** Presents `presented` as its host key and runs whatever it is asked. */
class FakeClient extends EventEmitter {
  config: any;
  command?: string;
  constructor(
    private readonly presented: Buffer,
    private readonly exitCode = 0
  ) {
    super();
  }
  connect(config: any) {
    this.config = config;
    setImmediate(() => {
      const ok = config.hostVerifier ? config.hostVerifier(this.presented) : true;
      if (!ok) this.emit('error', new Error('Host denied (verification failed)'));
      else this.emit('ready');
    });
  }
  exec(command: string, _o: any, cb: (e: undefined, s: FakeStream) => void) {
    this.command = command;
    const stream = new FakeStream();
    cb(undefined, stream);
    setImmediate(() => {
      stream.emit('data', Buffer.from('ok\n'));
      stream.emit('close', this.exitCode);
    });
  }
  end() {}
  destroy() {}
}

const server = (over: Partial<ServerRecord> = {}): ServerRecord => ({
  id: 'srv-1',
  tenantId: 't1',
  name: 'prod-1',
  host: 'prod-1.example.com',
  port: 22,
  username: 'deploy',
  hostKey: hostKeyFromBlob(PINNED).line,
  hostKeyFingerprint: fingerprintOf(PINNED),
  authMode: 'key',
  credentialId: 'cred-1',
  sudoAllowed: true,
  ...over,
});

function directory(
  opts: { server?: ServerRecord | null; policy?: Partial<TenantPolicy>; approvers?: string[] } = {}
) {
  const recorded: Array<Record<string, unknown>> = [];
  const keyReads: string[] = [];
  const dir: ServerDirectory = {
    get: async (tenantId, id) =>
      opts.server === null
        ? null
        : tenantId === 't1' && id === 'srv-1'
          ? (opts.server ?? server())
          : null,
    privateKey: async s => {
      keyReads.push(s.credentialId ?? '');
      return 'PRIVATE KEY';
    },
    certificate: async () => {
      throw new Error('not used');
    },
    policy: async () => ({ ...DEFAULT_POLICY, ...opts.policy }),
    approvers: async () => opts.approvers ?? [],
    record: async (_ref, _type, payload) => {
      recorded.push(payload);
    },
  };
  return { dir, recorded, keyReads };
}

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  tenantId: 't1',
  variables: {},
  previousOutputs: {},
  ...over,
});

describe('host keys', () => {
  it('parses an OpenSSH line and computes the OpenSSH fingerprint', () => {
    const line = `${hostKeyFromBlob(PINNED).line} root@host`;
    const parsed = parseHostKey(line);
    expect(parsed.type).toBe('ssh-ed25519');
    expect(parsed.blob.equals(PINNED)).toBe(true);
    expect(parsed.fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
  });

  it('rejects mismatched types, unknown types and garbage', () => {
    const b64 = PINNED.toString('base64');
    expect(() => parseHostKey(`ssh-rsa ${b64}`)).toThrow(/does not match/);
    expect(() => parseHostKey(`ssh-dss ${b64}`)).toThrow(/unsupported/);
    expect(() => parseHostKey('ssh-ed25519 not*base64')).toThrow(/base64/);
    expect(() => parseHostKey('ssh-ed25519')).toThrow();
  });

  it('scan reads the key and never authenticates', async () => {
    const client = new FakeClient(PINNED);
    const key = await scanHostKey('h', 22, () => client as any);
    expect(key.fingerprint).toBe(fingerprintOf(PINNED));
    expect(client.command).toBeUndefined();
  });
});

describe('SSHExecutor with registered servers', () => {
  it('connects with the server row and the pinned key', async () => {
    const client = new FakeClient(PINNED);
    const { dir, keyReads } = directory();
    const exec = new SSHExecutor(() => client as any, { directory: dir });
    const result = await exec.execute({ command: 'uptime', serverId: 'srv-1' }, ctx());
    expect(result.success).toBe(true);
    expect(client.config).toMatchObject({
      host: 'prod-1.example.com',
      username: 'deploy',
      privateKey: 'PRIVATE KEY',
    });
    expect(client.command).toBe('uptime');
    expect(keyReads).toEqual(['cred-1']);
    expect(result.output).toMatchObject({ server: { id: 'srv-1', name: 'prod-1' } });
  });

  it('refuses a server presenting a different host key', async () => {
    const client = new FakeClient(OTHER);
    const exec = new SSHExecutor(() => client as any, { directory: directory().dir });
    const result = await exec.execute({ command: 'uptime', serverId: 'srv-1' }, ctx());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/host key mismatch/);
    expect(client.command).toBeUndefined();
  });

  it('ignores host fields in the step when a server is chosen', async () => {
    const client = new FakeClient(PINNED);
    const exec = new SSHExecutor(() => client as any, { directory: directory().dir });
    await exec.execute(
      { command: 'id', serverId: 'srv-1', host: 'evil.example.com', username: 'root' },
      ctx()
    );
    expect(client.config).toMatchObject({ host: 'prod-1.example.com', username: 'deploy' });
  });

  it('does not reach servers of another workspace', async () => {
    const exec = new SSHExecutor(() => new FakeClient(PINNED) as any, {
      directory: directory().dir,
    });
    const result = await exec.execute(
      { command: 'id', serverId: 'srv-1' },
      ctx({ tenantId: 't2' })
    );
    expect(result.error).toMatch(/not registered in this workspace/);
  });

  it('refuses ad-hoc hosts under the default policy and allows them under `any`', async () => {
    const strict = new SSHExecutor(() => new FakeClient(PINNED) as any, {
      directory: directory().dir,
    });
    const refused = await strict.execute(
      { command: 'id', host: 'h.example.com', username: 'u', credentialId: 'k' },
      ctx({ secrets: { k: 'KEY' } })
    );
    expect(refused.error).toMatch(/only allows registered servers/);

    const client = new FakeClient(PINNED);
    const open = new SSHExecutor(() => client as any, {
      directory: directory({ policy: { sshPolicy: 'any' } }).dir,
    });
    const ok = await open.execute(
      { command: 'id', host: 'h.example.com', username: 'u', credentialId: 'k' },
      ctx({ secrets: { k: 'KEY' } })
    );
    expect(ok.success).toBe(true);
    expect(client.config.hostVerifier).toBeUndefined();
  });

  describe('privileged', () => {
    it('runs sudo -n directly before the command after enough approvals and audits it', async () => {
      const client = new FakeClient(PINNED);
      const { dir, recorded } = directory({ approvers: ['u-1'] });
      const exec = new SSHExecutor(() => client as any, { directory: dir });
      const result = await exec.execute(
        { command: 'systemctl restart nginx', serverId: 'srv-1', privileged: true, cwd: '/srv' },
        ctx()
      );
      expect(result.success).toBe(true);
      expect(client.command).toBe("cd '/srv' && sudo -n systemctl restart nginx");
      expect(recorded).toEqual([
        expect.objectContaining({
          command: "cd '/srv' && sudo -n systemctl restart nginx",
          approvers: ['u-1'],
          exitCode: 0,
          fingerprint: fingerprintOf(PINNED),
        }),
      ]);
    });

    it('needs as many distinct approvers as the policy asks', async () => {
      const client = new FakeClient(PINNED);
      const exec = new SSHExecutor(() => client as any, {
        directory: directory({ approvers: ['u-1'], policy: { privilegedApprovals: 2 } }).dir,
      });
      const result = await exec.execute(
        { command: 'reboot', serverId: 'srv-1', privileged: true },
        ctx()
      );
      expect(result.error).toMatch(/needs 2 approval/);
      expect(client.command).toBeUndefined();
    });

    it('is refused without approval, on servers without sudo, and on ad-hoc hosts', async () => {
      const none = new SSHExecutor(() => new FakeClient(PINNED) as any, {
        directory: directory().dir,
      });
      expect(
        (await none.execute({ command: 'x', serverId: 'srv-1', privileged: true }, ctx())).error
      ).toMatch(/needs 1 approval/);

      const noSudo = new SSHExecutor(() => new FakeClient(PINNED) as any, {
        directory: directory({ server: server({ sudoAllowed: false }), approvers: ['u'] }).dir,
      });
      expect(
        (await noSudo.execute({ command: 'x', serverId: 'srv-1', privileged: true }, ctx())).error
      ).toMatch(/not allowed on server/);

      const adHoc = new SSHExecutor(() => new FakeClient(PINNED) as any, {
        directory: directory({ policy: { sshPolicy: 'any' } }).dir,
      });
      expect(
        (
          await adHoc.execute(
            {
              command: 'x',
              host: 'h.example.com',
              username: 'u',
              credentialId: 'k',
              privileged: true,
            },
            ctx({ secrets: { k: 'KEY' } })
          )
        ).error
      ).toMatch(/need a registered server/);
    });
  });
});
