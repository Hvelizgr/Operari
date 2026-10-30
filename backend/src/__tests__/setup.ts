process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
// Executor tests use fake fetches against made-up hosts; the SSRF guard
// has its own tests that switch this off.
process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'true';
