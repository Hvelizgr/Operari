import { DEFAULT_POLICY, type TenantPolicy } from '../../../policy/tenant-policy';
import { DatabaseExecutor } from '../../../runbook/executors/database.executor';
import type { ExecutorContext } from '../../../runbook/types/executor.types';
import type { ServerDirectory, ServerRecord } from '../../../servers/server-directory';

jest.mock('../../../security/ssrf-guard', () => ({ blockedTarget: async () => null }));
const tunnels: Array<Record<string, unknown>> = [];
jest.mock('../../../runbook/executors/ssh-tunnel', () => ({
  createSSHTunnel: async (opts: Record<string, unknown>) => {
    tunnels.push(opts);
    return { localPort: 15432, close: async () => undefined };
  },
}));

const server = (over: Partial<ServerRecord> = {}): ServerRecord => ({
  id: 'srv-1',
  tenantId: 't1',
  name: 'bastion',
  host: 'bastion.example.com',
  port: 2222,
  username: 'tunnel',
  hostKey: 'ssh-ed25519 AAAA',
  hostKeyFingerprint: 'SHA256:x',
  authMode: 'key',
  credentialId: 'cred-1',
  sudoAllowed: false,
  ...over,
});

function directory(srv: ServerRecord | null, policy: Partial<TenantPolicy> = {}): ServerDirectory {
  return {
    get: async (tenantId, id) => (srv && tenantId === srv.tenantId && id === srv.id ? srv : null),
    privateKey: async () => 'BASTION KEY',
    certificate: async () => {
      throw new Error('unused');
    },
    policy: async () => ({ ...DEFAULT_POLICY, ...policy }),
    approvers: async () => [],
    record: async () => undefined,
  };
}

const pg = () => ({
  connect: async () => undefined,
  query: async () => ({ rows: [{ ok: 1 }], rowCount: 1, fields: [] }),
  end: async () => undefined,
});

const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'r',
  stepId: 's',
  tenantId: 't1',
  variables: {},
  previousOutputs: {},
  secrets: { db: 'postgresql://u:p@db.internal:5432/app', k: 'ADHOC KEY' },
  ...over,
});

beforeEach(() => tunnels.splice(0));

describe('database ssh tunnel through registered servers', () => {
  it('uses the server row and pins its host key', async () => {
    const exec = new DatabaseExecutor(() => pg() as any, { directory: directory(server()) });
    const result = await exec.execute(
      {
        operation: 'health',
        credentialId: 'db',
        sshTunnel: { serverId: 'srv-1', host: 'evil.example.com' },
      },
      ctx()
    );
    expect(result.success).toBe(true);
    expect(tunnels[0]).toMatchObject({
      sshHost: 'bastion.example.com',
      sshPort: 2222,
      sshUsername: 'tunnel',
      privateKey: 'BASTION KEY',
      hostKey: 'ssh-ed25519 AAAA',
      forwardHost: 'db.internal',
      forwardPort: 5432,
    });
  });

  it('refuses servers of another workspace and certificate servers', async () => {
    const other = new DatabaseExecutor(() => pg() as any, { directory: directory(server()) });
    expect(
      (
        await other.execute(
          { operation: 'health', credentialId: 'db', sshTunnel: { serverId: 'srv-1' } },
          ctx({ tenantId: 't2' })
        )
      ).error
    ).toMatch(/not registered/);
    const cert = new DatabaseExecutor(() => pg() as any, {
      directory: directory(server({ authMode: 'certificate' })),
    });
    expect(
      (
        await cert.execute(
          { operation: 'health', credentialId: 'db', sshTunnel: { serverId: 'srv-1' } },
          ctx()
        )
      ).error
    ).toMatch(/need key auth/);
    expect(tunnels).toHaveLength(0);
  });

  it('applies the workspace ssh policy to ad-hoc bastions', async () => {
    const adHoc = { host: 'b.example.com', username: 'u', sshCredentialId: 'k' };
    const strict = new DatabaseExecutor(() => pg() as any, { directory: directory(null) });
    expect(
      (await strict.execute({ operation: 'health', credentialId: 'db', sshTunnel: adHoc }, ctx()))
        .error
    ).toMatch(/only allows registered servers/);
    const open = new DatabaseExecutor(() => pg() as any, {
      directory: directory(null, { sshPolicy: 'any' }),
    });
    expect(
      (await open.execute({ operation: 'health', credentialId: 'db', sshTunnel: adHoc }, ctx()))
        .success
    ).toBe(true);
    expect(tunnels[0]).toMatchObject({ sshHost: 'b.example.com', privateKey: 'ADHOC KEY' });
    expect(tunnels[0].hostKey).toBeUndefined();
  });
});
