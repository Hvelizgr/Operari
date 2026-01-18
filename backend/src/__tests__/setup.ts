process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-for-zod-validation';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/nanoflow_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '4000';
process.env.FRONTEND_URL = 'http://localhost:3000';
