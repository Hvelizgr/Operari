import { Client } from 'ssh2';

import { blockedTarget } from '../../security/ssrf-guard';
import type { ServerDirectory, ServerRecord, StepRef } from '../../servers/server-directory';
import {
  runOverOpenSsh,
  runOverSsh2,
  type SpawnFn,
  type SshRunResult,
  type SshStreams,
} from '../../servers/ssh-transport';
import {
  credentialSecret,
  ExecutorContext,
  ExecutorResult,
  resolveTemplate,
  StepExecutor,
} from '../types/executor.types';

export interface SSHConfig {
  /** Shell command to execute on the remote host. Supports {{vars.x}} template substitution. */
  command: string;
  /**
   * Registered server (Settings → Servers). Host, port, user, credential
   * and the pinned host key all come from that row; the fields below are
   * ignored when this is set.
   */
  serverId?: string;
  /**
   * Run the command with `sudo -n`. Needs a registered server with sudo
   * allowed and, before it, the number of approvals the workspace policy
   * requires.
   */
  privileged?: boolean;
  /** Ad-hoc remote host. Only when the workspace ssh policy is `any`. */
  host?: string;
  /** SSH port (default: 22). Ad-hoc only. */
  port?: number;
  /** SSH username. Ad-hoc only. */
  username?: string;
  /** ConnectedAccount with the PEM private key. Ad-hoc only. */
  credentialId?: string;
  /** Working directory — prepended as `cd <cwd> &&` before the command. */
  cwd?: string;
  /** Environment variables to set on the remote shell. */
  env?: Record<string, string>;
  /** Maximum execution time in milliseconds (default: 60000). */
  timeout?: number;
  /** Whether to fail the step on non-zero exit code (default: true). */
  failOnNonZeroExit?: boolean;
}

export interface SSHOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  command: string;
  host: string;
  server?: { id: string; name: string; fingerprint: string };
  privileged?: boolean;
}

export interface SSHExecutorDeps {
  /** Without it (tests, bare setups) only ad-hoc steps run, as before. */
  directory?: ServerDirectory;
  spawn?: SpawnFn;
}

/**
 * SSH command executor.
 *
 * With `serverId`, the step targets a server the workspace registered:
 * the host key is pinned, the credential is read from the server row (or
 * a certificate is minted for this step), and `privileged` steps run as
 * `sudo -n` only after the required approvals. Ad-hoc host/username steps
 * remain for workspaces whose ssh policy is `any`.
 */
export class SSHExecutor implements StepExecutor<SSHConfig> {
  readonly type = 'ssh';

  /** Active connections indexed by `${runId}:${stepId}` for cancel support. */
  private readonly active = new Map<string, () => void>();

  private readonly createClient: () => Client;

  constructor(
    createClient?: () => Client,
    private readonly deps: SSHExecutorDeps = {}
  ) {
    this.createClient = createClient ?? (() => new Client());
  }

  async execute(config: SSHConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const fail = (error: string): ExecutorResult => ({
      success: false,
      error,
      duration: Date.now() - startTime,
    });
    const timeoutMs = config.timeout ?? 60_000;
    const failOnNonZero = config.failOnNonZeroExit ?? true;
    const command = resolveTemplate(config.command, context);
    const ref: StepRef = {
      tenantId: context.tenantId,
      runId: context.runId,
      stepId: context.stepId,
    };
    const directory = this.deps.directory;

    let server: ServerRecord | null = null;
    if (config.serverId) {
      if (!directory) return fail('ssh: registered servers are not available on this backend');
      server = await directory.get(context.tenantId, config.serverId);
      if (!server)
        return fail(`ssh: server "${config.serverId}" is not registered in this workspace`);
    } else if (directory) {
      const policy = await directory.policy(context.tenantId);
      if (policy.sshPolicy === 'registered') {
        return fail(
          'ssh: this workspace only allows registered servers. Register the host in Settings → Servers and pick it in the step.'
        );
      }
    }
    if (config.privileged && !server) {
      return fail('ssh: privileged steps need a registered server');
    }

    const host = server ? server.host : resolveTemplate(config.host ?? '', context);
    const port = server ? server.port : (config.port ?? 22);
    const username = server ? server.username : resolveTemplate(config.username ?? '', context);
    if (!host || !username) return fail('ssh: host and username are required');

    const remoteCommand = buildRemoteCommand(command, config, context);

    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] Would SSH to ${username}@${host}:${port}${server ? ` (${server.name})` : ''} and run: ${remoteCommand}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          host,
          port,
          username,
          command: remoteCommand,
          stdout: '',
          stderr: '',
          exitCode: 0,
        },
        duration: Date.now() - startTime,
      };
    }

    const blocked = await blockedTarget('host', host);
    if (blocked) return fail(`ssh: ${blocked}`);

    let approvers: string[] = [];
    if (config.privileged && server && directory) {
      if (!server.sudoAllowed) {
        return fail(`ssh: privileged steps are not allowed on server "${server.name}"`);
      }
      const policy = await directory.policy(context.tenantId);
      approvers = await directory.approvers(context.runId);
      if (approvers.length < policy.privilegedApprovals) {
        return fail(
          `ssh: privileged step needs ${policy.privilegedApprovals} approval(s) earlier in this run, found ${approvers.length}`
        );
      }
    }

    const connKey = `${context.runId}:${context.stepId}`;
    const streams: SshStreams = {
      onConnected: () =>
        context.emit?.({
          type: 'log',
          text: `Connected to ${host}:${port}${server ? ` (${server.name}, ${server.hostKeyFingerprint})` : ''}`,
          timestamp: new Date(),
        }),
      onStdout: text => context.emit?.({ type: 'stdout', text, timestamp: new Date() }),
      onStderr: text => context.emit?.({ type: 'stderr', text, timestamp: new Date() }),
    };

    let result: SshRunResult;
    try {
      if (server && server.authMode === 'certificate' && directory) {
        const cert = await directory.certificate(server, ref);
        result = await runOverOpenSsh(
          { host, port, username, hostKey: server.hostKey, ...cert },
          remoteCommand,
          {
            ...streams,
            env: config.env,
            timeoutMs,
            spawn: this.deps.spawn,
            register: kill => this.active.set(connKey, kill),
          }
        );
      } else {
        const privateKey =
          server && directory
            ? await directory.privateKey(server, ref)
            : credentialSecret(config.credentialId ?? '', context);
        if (!privateKey) {
          return fail(
            `SSH key not found: credentialId "${config.credentialId}" is not in context.secrets. Add a ConnectedAccount with provider="ssh" and reference it in the step config.`
          );
        }
        result = await runOverSsh2(
          { host, port, username, privateKey, hostKey: server?.hostKey },
          remoteCommand,
          {
            ...streams,
            env: config.env,
            timeoutMs,
            createClient: this.createClient,
            register: client => this.active.set(connKey, () => client.destroy()),
          }
        );
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    } finally {
      this.active.delete(connKey);
    }

    if (config.privileged && server && directory) {
      await directory
        .record(ref, 'ssh.privileged', {
          serverId: server.id,
          server: server.name,
          host,
          fingerprint: server.hostKeyFingerprint,
          command: remoteCommand,
          approvers,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
        })
        .catch(() => undefined);
    }

    const output: SSHOutput = {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      command,
      host,
      ...(server
        ? { server: { id: server.id, name: server.name, fingerprint: server.hostKeyFingerprint } }
        : {}),
      ...(config.privileged ? { privileged: true } : {}),
    };

    if (result.timedOut) {
      return {
        success: false,
        error: `SSH command timed out after ${timeoutMs}ms`,
        output: output as unknown as Record<string, unknown>,
        duration: Date.now() - startTime,
      };
    }

    const success = failOnNonZero ? result.exitCode === 0 : true;
    return {
      success,
      output: output as unknown as Record<string, unknown>,
      error: success ? undefined : `SSH command exited with code ${result.exitCode}`,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Best-effort cancel: destroy all SSH connections for the given runId.
   * Returns the number of connections destroyed.
   */
  cancel(runId: string): number {
    let count = 0;
    for (const [key, stop] of this.active) {
      if (key.startsWith(`${runId}:`)) {
        stop();
        this.active.delete(key);
        count++;
      }
    }
    return count;
  }
}

/**
 * `sudo -n` goes straight before the command, not around a `sh -c`, so a
 * sudoers rule listing exact commands (`/usr/bin/systemctl restart nginx`)
 * still matches. -n fails instead of prompting: Operari never holds a sudo
 * password.
 */
function buildRemoteCommand(command: string, config: SSHConfig, context: ExecutorContext): string {
  const body = config.privileged ? `sudo -n ${command}` : command;
  return config.cwd ? `cd ${shellEscape(resolveTemplate(config.cwd, context))} && ${body}` : body;
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
