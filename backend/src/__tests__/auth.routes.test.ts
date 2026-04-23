import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import authRoutes from '../routes/auth.routes';
import { prisma } from '../server';

jest.mock('../server', () => {
  const txCallable = async (ops: unknown[]) => Promise.all(ops);
  return {
    prisma: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      emailVerificationToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(ops => txCallable(ops as unknown[])),
    },
  };
});

jest.mock('../services/email.service', () => ({
  sendEmail: jest.fn(async () => ({ delivered: true, loggedOnly: true })),
}));

// Avoid hitting HIBP in tests. The common test passwords ("password123")
// actually appear in public breaches, so the live check would flip the
// register/reset suites into 400s. Dedicated breach-check coverage
// lives in auth/password-breach.test.ts.
jest.mock('../auth/password-breach', () => ({
  checkBreachedPassword: jest.fn(async () => ({ breached: false })),
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

      const response = await request(app).post('/auth/register').send({
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

      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        tenantName: 'Test Company',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'invalid-email',
        password: 'password123',
        tenantName: 'Test Company',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return validation error for short password', async () => {
      const response = await request(app).post('/auth/register').send({
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

      const response = await request(app).post('/auth/login').send({
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

      const response = await request(app).post('/auth/login').send({
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

      const response = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return validation error for invalid email format', async () => {
      const response = await request(app).post('/auth/login').send({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('rejects a locked account with the same generic 401 (no enumeration leak)', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 12);
      const lockedUser = {
        id: 'user-locked',
        email: 'locked@example.com',
        passwordHash,
        role: 'USER',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Test' },
        mfaEnabled: false,
        mfaSecretCiphered: null,
        failedLoginAttempts: 5,
        lastFailedLoginAt: new Date(),
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(lockedUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      // Correct password — but the account is locked, so the
      // response shape is identical to a wrong-password reply.
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'locked@example.com', password: 'correctpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
      // The lockout handler must NOT leak locked state — no
      // "account locked" / "retry later" / "X minutes remaining"
      // payload, or a scripted attacker learns which emails are
      // real.
      expect(response.body).not.toHaveProperty('lockedUntil');
      expect(response.body).not.toHaveProperty('retryAfter');
    });

    it('increments the failure counter on a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 12);
      const mockUser = {
        id: 'user-fail',
        email: 'fail@example.com',
        passwordHash,
        role: 'USER',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Test' },
        mfaEnabled: false,
        mfaSecretCiphered: null,
        failedLoginAttempts: 2,
        lastFailedLoginAt: new Date(),
        lockedUntil: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'fail@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      // The handler calls recordFailure → which updates the user
      // row with the next counter value. Find the update that
      // carries failedLoginAttempts (other updates unrelated to
      // the counter could exist on other flows, but not this
      // one).
      const updates = (prisma.user.update as jest.Mock).mock.calls.map(
        c => (c[0] as { data: { failedLoginAttempts?: number } }).data
      );
      const failureUpdate = updates.find(
        (d): d is { failedLoginAttempts: number } => typeof d.failedLoginAttempts === 'number'
      );
      expect(failureUpdate?.failedLoginAttempts).toBe(3);
    });

    it('surfaces mfaEnrollmentRequired when the tenant requires MFA and the user is not enrolled', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 12);
      const mockUser = {
        id: 'user-need-mfa',
        email: 'need-mfa@example.com',
        passwordHash,
        role: 'USER',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Test', mfaRequired: true },
        mfaEnabled: false,
        mfaSecretCiphered: null,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'need-mfa@example.com', password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body.mfaEnrollmentRequired).toBe(true);
    });

    it('does NOT surface mfaEnrollmentRequired when the tenant has no policy', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 12);
      const mockUser = {
        id: 'user-no-policy',
        email: 'no-policy@example.com',
        passwordHash,
        role: 'USER',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Test', mfaRequired: false },
        mfaEnabled: false,
        mfaSecretCiphered: null,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'no-policy@example.com', password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('mfaEnrollmentRequired');
    });

    it('clears the counter after a successful login', async () => {
      const passwordHash = await bcrypt.hash('correctpassword', 12);
      const mockUser = {
        id: 'user-ok',
        email: 'ok@example.com',
        passwordHash,
        role: 'USER',
        tenantId: 'tenant-1',
        tenant: { id: 'tenant-1', name: 'Test' },
        mfaEnabled: false,
        mfaSecretCiphered: null,
        failedLoginAttempts: 3,
        lastFailedLoginAt: new Date(),
        lockedUntil: null,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'ok@example.com', password: 'correctpassword' });

      expect(response.status).toBe(200);
      // The success path fires recordSuccess which wipes the
      // counter + any residual lock.
      await new Promise(r => setImmediate(r));
      const resetUpdate = (prisma.user.update as jest.Mock).mock.calls
        .map(c => (c[0] as { data: Record<string, unknown> }).data)
        .find(
          d => d.failedLoginAttempts === 0 && d.lockedUntil === null && d.lastFailedLoginAt === null
        );
      expect(resetUpdate).toBeTruthy();
    });
  });

  describe('Session cookie', () => {
    function cookieAttrs(setCookie: string): Record<string, string | true> {
      return Object.fromEntries(
        setCookie.split(';').map(p => {
          const [rawName, ...rest] = p.trim().split('=');
          return rest.length ? [rawName, rest.join('=')] : [rawName, true];
        })
      );
    }

    it('sets an HttpOnly nanorun_session cookie on register', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tenant.create as jest.Mock).mockResolvedValue({
        id: 't',
        name: 'Tenant',
        slug: 'tenant',
      });
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u',
        email: 't@example.com',
        name: 'Tenant',
        role: 'ADMIN',
        tenantId: 't',
      });

      const response = await request(app)
        .post('/auth/register')
        .send({ email: 't@example.com', password: 'password123', tenantName: 'Tenant' });

      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
      const session = cookies.find((c: string) => c.startsWith('nanorun_session='));
      expect(session).toBeDefined();
      const attrs = cookieAttrs(session!);
      expect(attrs.HttpOnly).toBe(true);
      expect(attrs.SameSite).toBe('Lax');
      expect(attrs.Path).toBe('/');
      expect(attrs['Max-Age']).toBeDefined();
    });

    it('sets the cookie on login', async () => {
      const passwordHash = await bcrypt.hash('password123', 12);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u',
        email: 't@example.com',
        passwordHash,
        tenantId: 't',
        role: 'USER',
        tenant: { id: 't', name: 'T' },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({ email: 't@example.com', password: 'password123' });

      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
      expect(cookies.some((c: string) => c.startsWith('nanorun_session='))).toBe(true);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('returns 204 when the email is not on file (no enumeration)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'ghost@example.com' });
      expect(response.status).toBe(204);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('returns 204 and creates a token when the email exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u-1',
        email: 'a@b.co',
        tenantId: 't-1',
        role: 'USER',
      });
      (prisma.passwordResetToken.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.passwordResetToken.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/auth/forgot-password').send({ email: 'a@b.co' });
      expect(response.status).toBe(204);
      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u-1' }),
        })
      );
    });

    it('returns 204 for malformed emails (no shape leak)', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' });
      expect(response.status).toBe(204);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('rejects an unknown token', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null);
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'deadbeef-token', password: 'newpassword123' });
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid or expired/i);
    });

    it('rejects an expired token', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        userId: 'u-1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        user: {
          id: 'u-1',
          email: 'a@b.co',
          role: 'USER',
          tenantId: 't-1',
          tenant: { id: 't-1', name: 'T' },
        },
      });
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'deadbeef-token', password: 'newpassword123' });
      expect(response.status).toBe(400);
    });

    it('rejects an already-used token (single-use)', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        userId: 'u-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(Date.now() - 30_000),
        user: {
          id: 'u-1',
          email: 'a@b.co',
          role: 'USER',
          tenantId: 't-1',
          tenant: { id: 't-1', name: 'T' },
        },
      });
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'deadbeef-token', password: 'newpassword123' });
      expect(response.status).toBe(400);
    });

    it('sets a new password and session cookie on a valid token', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'r-1',
        userId: 'u-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: {
          id: 'u-1',
          email: 'a@b.co',
          role: 'USER',
          tenantId: 't-1',
          tenant: { id: 't-1', name: 'T' },
        },
      });

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'deadbeef-token', password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      const cookies = response.headers['set-cookie'];
      const cookiesArray = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
      expect(cookiesArray.some((c: string) => c.startsWith('nanorun_session='))).toBe(true);
    });
  });

  describe('GET /auth/verify-email', () => {
    beforeEach(() => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
    });

    it('redirects to ?error=missing_token when no token', async () => {
      const response = await request(app).get('/auth/verify-email');
      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/error=missing_token/);
    });

    it('redirects to ?error=invalid_or_expired for an unknown token', async () => {
      (prisma.emailVerificationToken.findUnique as jest.Mock).mockResolvedValue(null);
      const response = await request(app).get('/auth/verify-email?token=bogus');
      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/error=invalid_or_expired/);
    });

    it('redirects to ?error=invalid_or_expired for an expired token', async () => {
      (prisma.emailVerificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'v-1',
        userId: 'u-1',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        user: { id: 'u-1', email: 'a@b.co' },
      });
      const response = await request(app).get('/auth/verify-email?token=bogus');
      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/error=invalid_or_expired/);
    });

    it('redirects to ?error=invalid_or_expired for a reused token', async () => {
      (prisma.emailVerificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'v-1',
        userId: 'u-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(Date.now() - 10_000),
        user: { id: 'u-1', email: 'a@b.co' },
      });
      const response = await request(app).get('/auth/verify-email?token=bogus');
      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/error=invalid_or_expired/);
    });

    it('marks emailVerified=true and redirects on a valid token', async () => {
      (prisma.emailVerificationToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'v-1',
        userId: 'u-1',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        user: { id: 'u-1', email: 'a@b.co' },
      });
      const response = await request(app).get('/auth/verify-email?token=good');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('http://localhost:3000/en/dashboard?verified=true');
      expect(prisma.$transaction).toHaveBeenCalled();
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

      const response = await request(app).post('/auth/register').send({
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

      const response = await request(app).post('/auth/login').send({
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
