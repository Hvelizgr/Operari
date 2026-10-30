import { Client, type ClientChannel, type ConnectConfig } from 'ssh2';

import { blockedTarget } from '../../security/ssrf-guard';
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
  /** Remote host (IP or hostname). Supports templates. */
  host: string;
  /** SSH port (default: 22). */
  port?: number;
  /** SSH username. Supports templates. */
  username: string;
  /**
   * ConnectedAccount ID whose accessToken holds the PEM-encoded private key.
   * Pre-resolved by SecretTemplateResolver into context.secrets[credentialId].
   */
  credentialId: string;
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
}

/**
 * SSH command executor.
 *
 * Connects to a remote host via SSH and runs a shell command.
 * Credentials are read from ConnectedAccount (provider="ssh") via
 * the pre-resolved secrets map in ExecutorContext.
 *
 * Unlike ShellExecutor, this does NOT delegate to a Runner — it
 * manages the SSH connection internally (same pattern as NotifyExecutor
 * managing its own HTTP calls).
 */
export class SSHExecutor implements StepExecutor<SSHConfig> {
  readonly type = 'ssh';

  /** Active connections indexed by `${runId}:${stepId}` for cancel support. */
  private readonly activeConnections = new Map<string, Client>();

  /** Injectable for testing. */
  private readonly createClient: () => Client;

  constructor(createClient?: () => Client) {
    this.createClient = createClient ?? (() => new Client());
  }

  async execute(config: SSHConfig, context: ExecutorContext): Promise<ExecutorResult> {
    const startTime = Date.now();
    const timeoutMs = config.timeout ?? 60_000;
    const failOnNonZero = config.failOnNonZeroExit ?? true;

    const host = resolveTemplate(config.host, context);
    const username = resolveTemplate(config.username, context);
    const command = resolveTemplate(config.command, context);
    const port = config.port ?? 22;

    // Dry-run: never open a real SSH connection. Emit a log line so the
    // run timeline shows what would have been executed, then return a
    // success result with `dryRun: true`.
    if (context.dryRun) {
      context.emit?.({
        type: 'log',
        text: `[dry-run] Would SSH to ${username}@${host}:${port} and run: ${command}`,
        timestamp: new Date(),
      });
      return {
        success: true,
        output: {
          dryRun: true,
          host,
          port,
          username,
          command,
          stdout: '',
          stderr: '',
          exitCode: 0,
        },
        duration: Date.now() - startTime,
      };
    }

    const blocked = await blockedTarget('host', host);
    if (blocked) {
      return { success: false, error: `ssh: ${blocked}`, duration: Date.now() - startTime };
    }

    // Read the private key from pre-resolved secrets.
    const privateKey = credentialSecret(config.credentialId, context);
    if (!privateKey) {
      return {
        success: false,
        error: `SSH key not found: credentialId "${config.credentialId}" is not in context.secrets. Add a ConnectedAccount with provider="ssh" and reference it in the step config.`,
        duration: Date.now() - startTime,
      };
    }

    const fullCommand = config.cwd
      ? `cd ${shellEscape(resolveTemplate(config.cwd, context))} && ${command}`
      : command;

    const connKey = `${context.runId}:${context.stepId}`;
    const client = this.createClient();
    this.activeConnections.set(connKey, client);

    try {
      const result = await this.runCommand(
        client,
        {
          host,
          port,
          username,
          privateKey,
        },
        fullCommand,
        config.env,
        timeoutMs,
        context
      );

      const output: SSHOutput = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        command,
        host,
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
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      };
    } finally {
      this.activeConnections.delete(connKey);
      client.end();
    }
  }

  /**
   * Best-effort cancel: destroy all SSH connections for the given runId.
   * Returns the number of connections destroyed.
   */
  cancel(runId: string): number {
    let count = 0;
    for (const [key, client] of this.activeConnections) {
      if (key.startsWith(`${runId}:`)) {
        client.destroy();
        this.activeConnections.delete(key);
        count++;
      }
    }
    return count;
  }

  private runCommand(
    client: Client,
    connectConfig: ConnectConfig,
    command: string,
    env: Record<string, string> | undefined,
    timeoutMs: number,
    context: ExecutorContext
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let channel: ClientChannel | null = null;

      const timer = setTimeout(() => {
        timedOut = true;
        channel?.close();
        client.end();
      }, timeoutMs);

      client.on('ready', () => {
        context.emit?.({
          type: 'log',
          text: `Connected to ${connectConfig.host}:${connectConfig.port ?? 22}`,
          timestamp: new Date(),
        });

        client.exec(command, { env }, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            return reject(err);
          }

          channel = stream;

          stream.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            context.emit?.({ type: 'stdout', text, timestamp: new Date() });
          });

          stream.stderr.on('data', (data: Buffer) => {
            const text = data.toString();
            stderr += text;
            context.emit?.({ type: 'stderr', text, timestamp: new Date() });
          });

          stream.on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({ stdout, stderr, exitCode: code, timedOut });
          });
        });
      });

      client.on('error', err => {
        clearTimeout(timer);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      client.connect(connectConfig);
    });
  }
}

/** Minimal shell escaping for the cwd path. */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
