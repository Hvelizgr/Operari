import { SSHExecutor, type SSHConfig } from '../../../runbook/executors/ssh.executor';
import type { ExecutorContext, ExecutorEvent } from '../../../runbook/types/executor.types';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Fake ssh2.Client
// ---------------------------------------------------------------------------

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
  close() {
    /* no-op */
  }
}

class FakeClient extends EventEmitter {
  public connectConfig: any;
  public lastCommand?: string;
  private exitCode: number | null;
  private stdoutData: string;
  private stderrData: string;
  private shouldFail: boolean;

  constructor(
    opts: {
      exitCode?: number | null;
      stdout?: string;
      stderr?: string;
      shouldFail?: boolean;
    } = {}
  ) {
    super();
    this.exitCode = opts.exitCode ?? 0;
    this.stdoutData = opts.stdout ?? '';
    this.stderrData = opts.stderr ?? '';
    this.shouldFail = opts.shouldFail ?? false;
  }

  connect(config: any) {
    this.connectConfig = config;
    if (this.shouldFail) {
      setImmediate(() => this.emit('error', new Error('Connection refused')));
      return;
    }
    setImmediate(() => this.emit('ready'));
  }

  exec(command: string, _opts: any, cb: (err: Error | undefined, stream: any) => void) {
    this.lastCommand = command;
    const stream = new FakeStream();
    cb(undefined, stream);

    setImmediate(() => {
      if (this.stdoutData) stream.emit('data', Buffer.from(this.stdoutData));
      if (this.stderrData) stream.stderr.emit('data', Buffer.from(this.stderrData));
      stream.emit('close', this.exitCode);
    });
  }

  end() {
    /* no-op */
  }
  destroy() {
    /* no-op */
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const execCtx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  tenantId: 'tenant-1',
  variables: { name: 'prod-server' },
  previousOutputs: {},
  secrets: {
    'ssh-key-1': '-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----',
  },
  ...overrides,
});

const sshConfig = (overrides: Partial<SSHConfig> = {}): SSHConfig => ({
  command: 'hostname',
  host: '10.0.1.5',
  username: 'deploy',
  credentialId: 'ssh-key-1',
  ...overrides,
});

describe('SSHExecutor', () => {
  it('connects to the correct host and runs the command', async () => {
    const fakeClient = new FakeClient({ stdout: 'prod-01\n', exitCode: 0 });
    const executor = new SSHExecutor(() => fakeClient as any);

    const result = await executor.execute(sshConfig(), execCtx());

    expect(fakeClient.connectConfig.host).toBe('10.0.1.5');
    expect(fakeClient.connectConfig.port).toBe(22);
    expect(fakeClient.connectConfig.username).toBe('deploy');
    expect(fakeClient.connectConfig.privateKey).toContain('OPENSSH');
    expect(fakeClient.lastCommand).toBe('hostname');
    expect(result.success).toBe(true);
    const output = result.output as any;
    expect(output.stdout).toBe('prod-01\n');
    expect(output.host).toBe('10.0.1.5');
  });

  it('resolves templates in host, username, and command', async () => {
    const fakeClient = new FakeClient({ exitCode: 0 });
    const executor = new SSHExecutor(() => fakeClient as any);

    await executor.execute(
      sshConfig({
        host: '{{vars.name}}',
        username: '{{vars.name}}',
        command: 'echo {{vars.name}}',
      }),
      execCtx()
    );

    expect(fakeClient.connectConfig.host).toBe('prod-server');
    expect(fakeClient.connectConfig.username).toBe('prod-server');
    expect(fakeClient.lastCommand).toBe('echo prod-server');
  });

  it('prepends cd when cwd is set', async () => {
    const fakeClient = new FakeClient({ exitCode: 0 });
    const executor = new SSHExecutor(() => fakeClient as any);

    await executor.execute(sshConfig({ cwd: '/app', command: 'ls' }), execCtx());

    expect(fakeClient.lastCommand).toBe("cd '/app' && ls");
  });

  it('fails when credentialId is not in secrets', async () => {
    const fakeClient = new FakeClient({ exitCode: 0 });
    const executor = new SSHExecutor(() => fakeClient as any);

    const result = await executor.execute(sshConfig({ credentialId: 'missing-key' }), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('SSH key not found');
    expect(result.error).toContain('missing-key');
  });

  it('marks non-zero exit code as failure by default', async () => {
    const fakeClient = new FakeClient({ exitCode: 1, stderr: 'not found' });
    const executor = new SSHExecutor(() => fakeClient as any);

    const result = await executor.execute(sshConfig(), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('exited with code 1');
  });

  it('honors failOnNonZeroExit=false', async () => {
    const fakeClient = new FakeClient({ exitCode: 2 });
    const executor = new SSHExecutor(() => fakeClient as any);

    const result = await executor.execute(sshConfig({ failOnNonZeroExit: false }), execCtx());

    expect(result.success).toBe(true);
  });

  it('streams stdout and stderr via emit', async () => {
    const fakeClient = new FakeClient({ stdout: 'out', stderr: 'err', exitCode: 0 });
    const executor = new SSHExecutor(() => fakeClient as any);

    const events: ExecutorEvent[] = [];
    const ctx = execCtx({ emit: e => events.push(e) });

    await executor.execute(sshConfig(), ctx);

    const stdoutEvents = events.filter(e => e.type === 'stdout');
    const stderrEvents = events.filter(e => e.type === 'stderr');
    expect(stdoutEvents.length).toBeGreaterThan(0);
    expect(stdoutEvents[0].text).toBe('out');
    expect(stderrEvents.length).toBeGreaterThan(0);
    expect(stderrEvents[0].text).toBe('err');
  });

  it('reports connection errors', async () => {
    const fakeClient = new FakeClient({ shouldFail: true });
    const executor = new SSHExecutor(() => fakeClient as any);

    const result = await executor.execute(sshConfig(), execCtx());

    expect(result.success).toBe(false);
    expect(result.error).toContain('SSH connection failed');
  });

  it('uses custom port', async () => {
    const fakeClient = new FakeClient({ exitCode: 0 });
    const executor = new SSHExecutor(() => fakeClient as any);

    await executor.execute(sshConfig({ port: 2222 }), execCtx());

    expect(fakeClient.connectConfig.port).toBe(2222);
  });
});
