import type { PrismaClient } from '@prisma/client';
import type { Namespace, Server as SocketServer } from 'socket.io';

import { AuditService } from '../audit/audit.service';
import { getAuthProvider } from '../auth';
import { logger } from '../config/logger.config';
import { PermissionService } from '../rbac/permission.service';
import { Permissions } from '../rbac/permissions';
import {
  allowedOriginsFrom,
  authenticateHandshake,
  socketError,
  SocketUser,
} from '../realtime/socket-auth';
import { localShellDenied } from '../runbook/executors/shell.executor';
import { getRunner } from '../runbook/runners';
import {
  TerminalClosedInfo,
  TerminalLimitError,
  TerminalRunnerType,
  TerminalSession,
  TerminalSessionManager,
} from './terminal-session';

export const TERMINAL_NAMESPACE = '/terminal';
const MAX_INPUT_CHUNK = 64 * 1024;

export { parseCookieHeader } from '../realtime/socket-auth';

export type TerminalUser = SocketUser;

export interface TerminalSocketDeps {
  allowedOrigins: string[];
  verifyToken(token: string): Promise<TerminalUser | null>;
  hasPermission(userId: string, permission: string): Promise<boolean>;
  /** Returns a reason when the tenant may not open a shell on this server. */
  denyReason(tenantId: string): string | null;
  manager: TerminalSessionManager;
  audit: Pick<AuditService, 'record'>;
}

export function registerTerminalNamespace(io: SocketServer, deps: TerminalSocketDeps): Namespace {
  const nsp = io.of(TERMINAL_NAMESPACE);

  nsp.use(async (socket, next) => {
    try {
      const auth = await authenticateHandshake(socket, deps);
      if (!auth.ok) return next(socketError(auth.code, auth.message));
      const user = auth.user;

      if (!(await deps.hasPermission(user.id, Permissions.Terminal.Open))) {
        return next(
          socketError('permission_denied', `Missing permission: ${Permissions.Terminal.Open}`)
        );
      }

      const denied = deps.denyReason(user.tenantId);
      if (denied) return next(socketError('terminal_disabled', denied));

      socket.data.user = user;
      next();
    } catch (err) {
      logger.error({ err }, 'terminal handshake failed');
      next(socketError('internal', 'Terminal unavailable'));
    }
  });

  nsp.on('connection', socket => {
    const user = socket.data.user as TerminalUser;
    let session: TerminalSession | null = null;

    socket.on('open', (payload: { cols?: unknown; rows?: unknown; lang?: unknown } | undefined) => {
      if (session) return;
      try {
        session = deps.manager.open(
          { tenantId: user.tenantId, userId: user.id },
          { cols: payload?.cols, rows: payload?.rows, lang: payload?.lang },
          {
            onData: data => socket.emit('output', data),
            onExit: info => {
              session = null;
              void recordClosed(deps.audit, info);
              socket.emit('exit', { exitCode: info.exitCode, reason: info.reason });
              socket.disconnect(true);
            },
          }
        );
      } catch (err) {
        const message =
          err instanceof TerminalLimitError ? err.message : 'Could not start the terminal';
        if (!(err instanceof TerminalLimitError)) logger.error({ err }, 'terminal spawn failed');
        socket.emit('terminal_error', { message });
        socket.disconnect(true);
        return;
      }

      void deps.audit
        .record({
          tenantId: user.tenantId,
          type: 'terminal.opened',
          actorId: user.id,
          actorType: 'user',
          resource: `terminal:${session.id}`,
          payload: { sessionId: session.id, runner: session.runner, ip: socket.handshake.address },
        })
        .catch(err => logger.error({ err }, 'terminal.opened audit failed'));

      socket.emit('opened', {
        sessionId: session.id,
        runner: session.runner,
        persistent: session.persistent,
      });
    });

    socket.on('input', (data: unknown) => {
      if (!session || typeof data !== 'string' || data.length > MAX_INPUT_CHUNK) return;
      session.write(data);
    });

    socket.on('resize', (size: { cols?: unknown; rows?: unknown } | undefined) => {
      session?.resize(size?.cols, size?.rows);
    });

    socket.on('close', () => session?.close('client'));
    socket.on('disconnect', () => session?.close('disconnect'));
  });

  return nsp;
}

async function recordClosed(audit: Pick<AuditService, 'record'>, info: TerminalClosedInfo) {
  try {
    await audit.record({
      tenantId: info.owner.tenantId,
      type: 'terminal.closed',
      actorId: info.owner.userId,
      actorType: 'user',
      resource: `terminal:${info.sessionId}`,
      payload: {
        sessionId: info.sessionId,
        runner: info.runner,
        reason: info.reason,
        exitCode: info.exitCode,
        durationMs: info.durationMs,
        outputBytes: info.outputBytes,
        inputBytes: info.inputBytes,
        recordingSha256: info.recording.sha256,
        recordingBytes: info.recording.bytes,
        recordingTruncated: info.recording.truncated,
      },
    });
  } catch (err) {
    logger.error({ err }, 'terminal.closed audit failed');
  }
}

/**
 * Wires the terminal into the running Socket.IO server. Returns null (and
 * logs why) when the configured runner cannot host an interactive shell or
 * the operator switched the feature off.
 */
export function attachTerminal(
  io: SocketServer,
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env
): TerminalSessionManager | null {
  if (env.OPERARI_TERMINAL === 'off') {
    logger.info('Terminal disabled (OPERARI_TERMINAL=off)');
    return null;
  }
  const runner = getRunner();
  if (runner.type !== 'local' && runner.type !== 'docker') {
    logger.warn({ runner: runner.type }, 'Terminal not available on this runner');
    return null;
  }

  let manager: TerminalSessionManager;
  try {
    manager = new TerminalSessionManager({
      runner: runner.type as TerminalRunnerType,
      dockerBinary: env.DOCKER_BINARY,
      image: env.OPERARI_TERMINAL_IMAGE || env.OPERARI_RUNNER_IMAGE || undefined,
      network: env.OPERARI_TERMINAL_NETWORK || undefined,
      recordingsDir: env.OPERARI_TERMINAL_RECORDINGS_DIR || undefined,
      workspacesDir: env.OPERARI_WORKSPACES_DIR || undefined,
      idleTimeoutMs: env.OPERARI_TERMINAL_IDLE_MS
        ? Number(env.OPERARI_TERMINAL_IDLE_MS)
        : undefined,
    });
  } catch (err) {
    logger.error({ err }, 'Terminal disabled: node-pty could not be loaded');
    return null;
  }

  const permissions = new PermissionService(prisma);
  const allowedOrigins = allowedOriginsFrom(env.FRONTEND_URL);

  registerTerminalNamespace(io, {
    allowedOrigins,
    verifyToken: async token => {
      const user = await getAuthProvider(prisma).verifyToken(token);
      return user ? { id: user.id, email: user.email, tenantId: user.tenantId } : null;
    },
    hasPermission: (userId, permission) => permissions.hasPermission(userId, permission),
    denyReason: tenantId => localShellDenied(runner, tenantId),
    manager,
    audit: new AuditService(prisma),
  });
  logger.info({ runner: runner.type }, 'Interactive terminal ready on /terminal');
  return manager;
}
