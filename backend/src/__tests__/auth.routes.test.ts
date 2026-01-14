import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRoutes from '../routes/auth.routes';
import { prisma } from '../server';

jest.mock('../server', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        tenant: {
            create: jest.fn(),
        },
    },
}));

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });

    describe('POST /auth/register', () => {
        it('should successfully register a new user', async () => {
            const mockTenant = {
                id: 'tenant-1',
                name: 'Test Company',
                slug: 'test-company-123',
            };

            const mockUser = {
                id: 'user-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'ADMIN',
                tenantId: 'tenant-1',
                passwordHash: 'hashed',
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.tenant.create as jest.Mock).mockResolvedValue(mockTenant);
            (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User',
                    tenantName: 'Test Company',
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tenant');
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.tenant.name).toBe('Test Company');
        });

        it('should return error if email already exists', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue({
                id: 'existing-user',
                email: 'test@example.com',
            });

            const response = await request(app)
                .post('/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    tenantName: 'Test Company',
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Email already registered');
        });

        it('should return validation error for invalid email', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'password123',
                    tenantName: 'Test Company',
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should return validation error for short password', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'short',
                    tenantName: 'Test Company',
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /auth/login', () => {
        it('should successfully login with valid credentials', async () => {
            const passwordHash = await bcrypt.hash('password123', 12);
            const mockUser = {
                id: 'user-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'ADMIN',
                tenantId: 'tenant-1',
                passwordHash,
                tenant: {
                    id: 'tenant-1',
                    name: 'Test Company',
                },
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tenant');
            expect(response.body).toHaveProperty('token');
            expect(response.body.user.email).toBe('test@example.com');

            const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET!) as any;
            expect(decoded.userId).toBe('user-1');
            expect(decoded.email).toBe('test@example.com');
        });

        it('should return error for non-existent user', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should return error for invalid password', async () => {
            const passwordHash = await bcrypt.hash('correctpassword', 12);
            const mockUser = {
                id: 'user-1',
                email: 'test@example.com',
                passwordHash,
                tenant: { id: 'tenant-1', name: 'Test' },
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Invalid credentials');
        });

        it('should return validation error for invalid email format', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'invalid-email',
                    password: 'password123',
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('JWT Token Validation', () => {
        it('should generate valid JWT token on registration', async () => {
            const mockTenant = {
                id: 'tenant-1',
                name: 'Test Company',
                slug: 'test-company-123',
            };

            const mockUser = {
                id: 'user-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'ADMIN',
                tenantId: 'tenant-1',
                passwordHash: 'hashed',
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.tenant.create as jest.Mock).mockResolvedValue(mockTenant);
            (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    tenantName: 'Test Company',
                });

            const token = response.body.token;
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

            expect(decoded).toHaveProperty('userId');
            expect(decoded).toHaveProperty('email');
            expect(decoded).toHaveProperty('role');
            expect(decoded).toHaveProperty('tenantId');
            expect(decoded.userId).toBe('user-1');
            expect(decoded.email).toBe('test@example.com');
        });

        it('should generate valid JWT token on login', async () => {
            const passwordHash = await bcrypt.hash('password123', 12);
            const mockUser = {
                id: 'user-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'USER',
                tenantId: 'tenant-1',
                passwordHash,
                tenant: {
                    id: 'tenant-1',
                    name: 'Test Company',
                },
            };

            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            const token = response.body.token;
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

            expect(decoded.userId).toBe('user-1');
            expect(decoded.email).toBe('test@example.com');
            expect(decoded.role).toBe('USER');
            expect(decoded.tenantId).toBe('tenant-1');
        });
    });
});
