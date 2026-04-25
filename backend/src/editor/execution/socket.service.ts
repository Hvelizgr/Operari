import { createAdapter } from '@socket.io/redis-adapter';
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { logger } from '../../config/logger.config';

export class SocketService {
  private static instance: SocketService;
  private io: SocketServer | null = null;

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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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

    this.io.on('connection', socket => {
      logger.info({ socketId: socket.id }, 'Client connected to Socket.io');

      socket.on('join_execution', (executionId: string) => {
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
