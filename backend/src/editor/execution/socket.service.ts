import { createAdapter } from '@socket.io/redis-adapter';
import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';

import { logger } from '../../config/logger.config';
import { type SocketAuthResult, socketError, type SocketUser } from '../../realtime/socket-auth';

/**
 * Gate for the default namespace. Without it any client that guessed or
 * scraped an execution id could tail that run's stdout across tenants.
 */
export interface ExecutionRoomGuard {
  authenticate(socket: Socket): Promise<SocketAuthResult>;
  canJoin(user: SocketUser, executionId: string): Promise<boolean>;
}

export class SocketService {
  private static instance: SocketService;
  private io: SocketServer | null = null;
  private guard: ExecutionRoomGuard | null = null;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  initialize(server: HttpServer, frontendUrl: string) {
    this.io = new SocketServer(server, {
      cors: {
        origin: frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Multi-instance fanout: when Redis is configured, attach the
    // official Redis adapter so `io.to(room).emit(...)` on node A is
    // received by clients connected to node B. Without the adapter,
    // node_status + execution_status events only reached clients on
    // the same node that produced them — a silent fail for any horizontal
    // deploy. Duplicating the client is required by the adapter: one
    // for PUBLISH, one for SUBSCRIBE, since ioredis rejects commands on
    // a subscribed connection.
    //
    // Lazy-require so the module load of socket.service doesn't pull
    // in Redis initialization side-effects in unit tests that never
    // call initialize() (several of them mock logger differently and
    // would trigger the connect handler against the undefined mock).
    try {
      const { redisConfig } = require('../../config/redis.config');
      const pub = redisConfig.getClient();
      if (pub && redisConfig.isReady()) {
        const sub = pub.duplicate();
        this.io.adapter(createAdapter(pub, sub));
        logger.info('Socket.io Redis adapter wired for multi-instance fanout');
      } else {
        logger.warn(
          'Socket.io running without Redis adapter — multi-instance emits will not fan out'
        );
      }
    } catch (err) {
      logger.error({ err }, 'Failed to wire Socket.io Redis adapter; continuing without fanout');
    }

    this.io.use(async (socket, next) => {
      if (!this.guard) return next();
      try {
        const auth = await this.guard.authenticate(socket);
        if (!auth.ok) return next(socketError(auth.code, auth.message));
        socket.data.user = auth.user;
        next();
      } catch (err) {
        logger.error({ err }, 'Socket.io handshake failed');
        next(socketError('internal', 'Realtime unavailable'));
      }
    });

    this.io.on('connection', socket => {
      logger.info({ socketId: socket.id }, 'Client connected to Socket.io');

      socket.on('join_execution', async (executionId: unknown) => {
        if (typeof executionId !== 'string' || !executionId) return;
        if (this.guard) {
          const user = socket.data.user as SocketUser | undefined;
          let allowed = false;
          try {
            allowed = Boolean(user) && (await this.guard.canJoin(user as SocketUser, executionId));
          } catch (err) {
            logger.error({ err, executionId }, 'execution room check failed');
          }
          if (!allowed) {
            socket.emit('join_denied', { executionId });
            return;
          }
        }
        socket.join(`execution:${executionId}`);
        logger.debug({ socketId: socket.id, executionId }, 'Client joined execution room');
      });

      socket.on('leave_execution', (executionId: string) => {
        socket.leave(`execution:${executionId}`);
        logger.debug({ socketId: socket.id, executionId }, 'Client left execution room');
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Client disconnected from Socket.io');
      });
    });

    return this.io;
  }

  setGuard(guard: ExecutionRoomGuard | null): void {
    this.guard = guard;
  }

  getServer(): SocketServer | null {
    return this.io;
  }

  emitLog(executionId: string, log: string, metadata?: Record<string, unknown>) {
    // Live UI delivery via socket.io.
    if (this.io) {
      this.io.to(`execution:${executionId}`).emit('log', {
        message: log,
        timestamp: new Date().toISOString(),
        metadata,
      });
    }

    // Durable copy via Redis Streams (P1 #8 phase 1). Best-effort:
    // if Redis is not configured the publish is a no-op, and any
    // Redis error is swallowed inside LogStreamService. The socket
    // path is the live UI fallback; the stream is the persistence
    // + replay layer. Both fail independently.
    // Lazy require to avoid a hard import dep that test environments
    // would have to mock.
    try {
      const { getLogStream } = require('../../observability/log-stream.service');
      void getLogStream().publish(executionId, log, metadata);
    } catch {
      // Module load failure (e.g. test that mocks this path away)
      // — the socket emit already happened, no further action.
    }
  }

  emitNodeStatus(executionId: string, nodeId: string, status: string, result?: unknown) {
    if (!this.io) return;
    this.io.to(`execution:${executionId}`).emit('node_status', {
      nodeId,
      status,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  emitExecutionStatus(executionId: string, status: string) {
    if (!this.io) return;
    this.io.to(`execution:${executionId}`).emit('execution_status', {
      status,
      timestamp: new Date().toISOString(),
    });
  }
}

export const socketService = SocketService.getInstance();
