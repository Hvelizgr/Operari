import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../../config/logger.config';

export class SocketService {
    private static instance: SocketService;
    private io: SocketServer | null = null;

    private constructor() { }

    static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    initialize(server: HttpServer, frontendUrl: string) {
        // Support multiple origins in development (localhost and local network IPs)
        const isDevelopment = process.env.NODE_ENV === 'development';
        const corsOrigin = isDevelopment
            ? [frontendUrl, /^http:\/\/localhost:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/]
            : frontendUrl;

        this.io = new SocketServer(server, {
            cors: {
                origin: corsOrigin,
                methods: ['GET', 'POST'],
                credentials: true,
            },
        });

        this.io.on('connection', (socket) => {
            logger.info({ socketId: socket.id }, 'Client connected to Socket.io');

            // --- Execution Rooms ---
            socket.on('join_execution', (executionId: string) => {
                socket.join(`execution:${executionId}`);
                logger.debug({ socketId: socket.id, executionId }, 'Client joined execution room');
            });

            socket.on('leave_execution', (executionId: string) => {
                socket.leave(`execution:${executionId}`);
                logger.debug({ socketId: socket.id, executionId }, 'Client left execution room');
            });

            // --- Workflow Collaboration Rooms ---
            socket.on('join_workflow', (data: { workflowId: string, user: any }) => {
                const { workflowId, user } = data;
                socket.join(`workflow:${workflowId}`);
                // Store user info in socket for presence
                (socket as any).workflowId = workflowId;
                (socket as any).userData = user;
                
                socket.to(`workflow:${workflowId}`).emit('user_joined', { socketId: socket.id, user });
                logger.debug({ socketId: socket.id, workflowId }, 'Client joined workflow collaboration');
            });

            socket.on('leave_workflow', (workflowId: string) => {
                socket.leave(`workflow:${workflowId}`);
                socket.to(`workflow:${workflowId}`).emit('user_left', { socketId: socket.id });
                logger.debug({ socketId: socket.id, workflowId }, 'Client left workflow collaboration');
            });

            socket.on('workflow_changes', (data: { workflowId: string, changes: any }) => {
                const { workflowId, changes } = data;
                // Broadcast changes to everyone else in the room
                socket.to(`workflow:${workflowId}`).emit('remote_workflow_changes', { 
                    senderId: socket.id, 
                    changes 
                });
            });

            socket.on('cursor_move', (data: { workflowId: string, position: { x: number, y: number } }) => {
                const { workflowId, position } = data;
                socket.to(`workflow:${workflowId}`).emit('remote_cursor_move', {
                    userId: socket.id,
                    userData: (socket as any).userData,
                    position
                });
            });

            socket.on('disconnect', () => {
                const workflowId = (socket as any).workflowId;
                if (workflowId) {
                    socket.to(`workflow:${workflowId}`).emit('user_left', { socketId: socket.id });
                }
                logger.info({ socketId: socket.id }, 'Client disconnected from Socket.io');
            });
        });

        return this.io;
    }

    emitLog(executionId: string, log: string, metadata?: any) {
        if (!this.io) return;
        this.io.to(`execution:${executionId}`).emit('log', {
            message: log,
            timestamp: new Date().toISOString(),
            metadata,
        });
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
