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

  emitLog(executionId: string, log: string, metadata?: any) {
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

  emitNodeStatus(executionId: string, nodeId: string, status: string, result?: any) {
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
