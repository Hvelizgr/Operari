process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

// Tests assert auth gates explicitly (e.g. "returns 401 when no user
// is authenticated") and must not depend on whatever the developer's
// .env happens to set. Force anonymous mode + dev-login OFF here so a
// dev-friendly self-host config never bleeds into the test contract.
process.env.OPERARI_ANONYMOUS_MODE = 'false';
process.env.OPERARI_DEV_LOGIN_ENABLED = 'false';
