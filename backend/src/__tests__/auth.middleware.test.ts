import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

jest.mock('../server', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
        },
    },
}));

describe('Auth Middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        mockRequest = {
            headers: {},
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        nextFunction = jest.fn();
    });

    describe('authenticate', () => {
        it('should authenticate valid token', async () => {
            const mockUser = {
                id: 'user-1',
                email: 'test@example.com',
                role: 'ADMIN',
                tenantId: 'tenant-1',
            };

            const token = jwt.sign(
                {
                    userId: mockUser.id,
                    email: mockUser.email,
                    role: mockUser.role,
                    tenantId: mockUser.tenantId,
                },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            mockRequest.headers = {
                authorization: `Bearer ${token}`,
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: 'user-1' },
            });
            expect(mockRequest.user).toEqual({
                id: 'user-1',
                email: 'test@example.com',
                role: 'ADMIN',
                tenantId: 'tenant-1',
            });
            expect(nextFunction).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should reject request with no token', async () => {
            mockRequest.headers = {};

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'No token provided',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject request with invalid token format', async () => {
            mockRequest.headers = {
                authorization: 'InvalidFormat token123',
            };

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'No token provided',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject expired token', async () => {
            const expiredToken = jwt.sign(
                {
                    userId: 'user-1',
                    email: 'test@example.com',
                    role: 'USER',
                    tenantId: 'tenant-1',
                },
                process.env.JWT_SECRET!,
                { expiresIn: '-1h' }
            );

            mockRequest.headers = {
                authorization: `Bearer ${expiredToken}`,
            };

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Invalid token',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject invalid token signature', async () => {
            const invalidToken = jwt.sign(
                {
                    userId: 'user-1',
                    email: 'test@example.com',
                    role: 'USER',
                    tenantId: 'tenant-1',
                },
                'wrong-secret',
                { expiresIn: '7d' }
            );

            mockRequest.headers = {
                authorization: `Bearer ${invalidToken}`,
            };

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Invalid token',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject malformed token', async () => {
            mockRequest.headers = {
                authorization: 'Bearer malformed.token.here',
            };

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Invalid token',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should reject when user not found in database', async () => {
            const token = jwt.sign(
                {
                    userId: 'non-existent-user',
                    email: 'test@example.com',
                    role: 'USER',
                    tenantId: 'tenant-1',
                },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            mockRequest.headers = {
                authorization: `Bearer ${token}`,
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            // Hardening: the middleware now returns a uniform "Invalid
            // token" message for both "bad signature" and "valid
            // signature but user does not exist". The previous
            // distinction leaked an oracle that let an attacker
            // confirm whether a userId existed in the database via
            // response comparison.
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Invalid token',
            });
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should handle different user roles', async () => {
            const roles = ['ADMIN', 'USER', 'VIEWER'];

            for (const role of roles) {
                jest.clearAllMocks();

                const mockUser = {
                    id: 'user-1',
                    email: 'test@example.com',
                    role,
                    tenantId: 'tenant-1',
                };

                const token = jwt.sign(
                    {
                        userId: mockUser.id,
                        email: mockUser.email,
                        role: mockUser.role,
                        tenantId: mockUser.tenantId,
                    },
                    process.env.JWT_SECRET!,
                    { expiresIn: '7d' }
                );

                mockRequest.headers = {
                    authorization: `Bearer ${token}`,
                };

                (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

                await authenticate(
                    mockRequest as AuthRequest,
                    mockResponse as Response,
                    nextFunction
                );

                expect(mockRequest.user?.role).toBe(role);
                expect(nextFunction).toHaveBeenCalled();
            }
        });

        it('should preserve all user data in request', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'detailed@example.com',
                role: 'ADMIN',
                tenantId: 'tenant-456',
            };

            const token = jwt.sign(
                {
                    userId: mockUser.id,
                    email: mockUser.email,
                    role: mockUser.role,
                    tenantId: mockUser.tenantId,
                },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            mockRequest.headers = {
                authorization: `Bearer ${token}`,
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

            await authenticate(
                mockRequest as AuthRequest,
                mockResponse as Response,
                nextFunction
            );

            expect(mockRequest.user).toEqual({
                id: 'user-123',
                email: 'detailed@example.com',
                role: 'ADMIN',
                tenantId: 'tenant-456',
            });
        });
    });
});
