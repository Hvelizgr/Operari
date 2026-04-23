import { generateKeyPairSync, createSign, KeyObject } from 'crypto';
import { WorkOSJwksVerifier, type JsonWebKeySet } from '../../auth/workos-jwks-verifier';

/**
 * End-to-end tests for the WorkOS JWKS verifier using a self-signed
 * RSA key pair and a fake fetch. Pins the security contract:
 *   - alg=none / alg=HS256 are rejected
 *   - missing kid is rejected
 *   - bad signature is rejected
 *   - expired tokens are rejected
 *   - wrong issuer / audience is rejected
 *   - kid rotation forces a JWKS re-fetch
 */

const ISSUER = 'https://api.workos.test';
const AUDIENCE = 'client_test';
const JWKS_URL = 'https://api.workos.test/sso/jwks/client_test';

function generateRsaPair(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwk = publicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };
  return {
    kid,
    privateKey,
    publicKey,
    jwk: { kid, kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' },
  };
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(
  privateKey: KeyObject,
  header: Record<string, unknown>,
  claims: Record<string, unknown>
): string {
  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${claimsB64}`;
  const signer = createSign('RSA-SHA256');
  signer.update(Buffer.from(signingInput, 'utf8'));
  const sig = signer.sign(privateKey);
  return `${signingInput}.${base64url(sig)}`;
}

const validClaims = (over: Record<string, unknown> = {}) => ({
  sub: 'workos-user-1',
  email: 'sso@enterprise.test',
  organization_id: 'org-1',
  role: 'admin',
  iat: Math.floor(Date.now() / 1000) - 10,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iss: ISSUER,
  aud: AUDIENCE,
  ...over,
});

function buildFetch(keys: Array<{ kid: string; jwk: Record<string, unknown> }>): {
  fn: typeof fetch;
  callCount: () => number;
} {
  let calls = 0;
  const fn = (async () => {
    calls++;
    const body: JsonWebKeySet = {
      keys: keys.map(k => k.jwk) as never,
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fn, callCount: () => calls };
}

describe('WorkOSJwksVerifier', () => {
  describe('happy path', () => {
    it('verifies a valid RS256 token signed by a key in the JWKS', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });

      const token = signJwt(
        key.privateKey,
        { alg: 'RS256', kid: 'key-1', typ: 'JWT' },
        validClaims()
      );
      const claims = await verifier.verify(token);
      expect(claims).not.toBeNull();
      expect(claims!.email).toBe('sso@enterprise.test');
      expect(claims!.organization_id).toBe('org-1');
      expect(claims!.role).toBe('admin');
    });

    it('caches the JWKS — second verify with the same kid does not re-fetch', async () => {
      const key = generateRsaPair('key-1');
      const { fn, callCount } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });

      const token = signJwt(
        key.privateKey,
        { alg: 'RS256', kid: 'key-1', typ: 'JWT' },
        validClaims()
      );

      await verifier.verify(token);
      await verifier.verify(token);
      await verifier.verify(token);

      expect(callCount()).toBe(1);
    });
  });

  describe('algorithm allowlist', () => {
    it('rejects alg=none', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });

      // Build a token by hand with alg=none and an empty signature
      const headerB64 = base64url(JSON.stringify({ alg: 'none', kid: 'key-1' }));
      const payloadB64 = base64url(JSON.stringify(validClaims()));
      const token = `${headerB64}.${payloadB64}.`;
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('rejects alg=HS256 (the public-key-as-secret attack)', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });

      const headerB64 = base64url(JSON.stringify({ alg: 'HS256', kid: 'key-1' }));
      const payloadB64 = base64url(JSON.stringify(validClaims()));
      // Even with a syntactically-valid HMAC signature, alg !== 'RS256' is rejected before signature check
      const token = `${headerB64}.${payloadB64}.fakesignature`;
      await expect(verifier.verify(token)).resolves.toBeNull();
    });
  });

  describe('rejection paths', () => {
    it('rejects a malformed JWT (wrong number of parts)', async () => {
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: buildFetch([]).fn,
      });
      await expect(verifier.verify('not.a.jwt.really')).resolves.toBeNull();
      await expect(verifier.verify('only.one')).resolves.toBeNull();
      await expect(verifier.verify('')).resolves.toBeNull();
    });

    it('rejects a token without kid', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const token = signJwt(key.privateKey, { alg: 'RS256' }, validClaims());
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('rejects a token signed by an unknown key (kid not in JWKS)', async () => {
      const inJwks = generateRsaPair('key-1');
      const orphan = generateRsaPair('key-rogue');
      const { fn } = buildFetch([inJwks]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const token = signJwt(orphan.privateKey, { alg: 'RS256', kid: 'key-rogue' }, validClaims());
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('rejects a token with a tampered payload', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const valid = signJwt(key.privateKey, { alg: 'RS256', kid: 'key-1' }, validClaims());
      // Replace the payload with a different one — signature no longer matches
      const [h, , s] = valid.split('.');
      const tamperedPayload = base64url(
        JSON.stringify(validClaims({ role: 'admin', email: 'attacker@evil.test' }))
      );
      const tampered = `${h}.${tamperedPayload}.${s}`;
      await expect(verifier.verify(tampered)).resolves.toBeNull();
    });

    it('rejects an expired token', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
        clockSkewSeconds: 0,
      });
      const token = signJwt(
        key.privateKey,
        { alg: 'RS256', kid: 'key-1' },
        validClaims({ exp: Math.floor(Date.now() / 1000) - 60 })
      );
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('rejects a wrong-issuer token', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const token = signJwt(
        key.privateKey,
        { alg: 'RS256', kid: 'key-1' },
        validClaims({ iss: 'https://evil.test' })
      );
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('rejects a wrong-audience token', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const token = signJwt(
        key.privateKey,
        { alg: 'RS256', kid: 'key-1' },
        validClaims({ aud: 'another_app' })
      );
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('rejects a token missing required claims (sub/email/organization_id)', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const partialClaims = validClaims();
      delete (partialClaims as Record<string, unknown>).organization_id;
      const token = signJwt(key.privateKey, { alg: 'RS256', kid: 'key-1' }, partialClaims);
      await expect(verifier.verify(token)).resolves.toBeNull();
    });

    it('returns null when the JWKS endpoint is unreachable', async () => {
      const failingFetch = (async () => {
        throw new Error('ENETUNREACH');
      }) as unknown as typeof fetch;
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: failingFetch,
      });
      const key = generateRsaPair('key-1');
      const token = signJwt(key.privateKey, { alg: 'RS256', kid: 'key-1' }, validClaims());
      await expect(verifier.verify(token)).resolves.toBeNull();
    });
  });

  describe('kid rotation', () => {
    it('cache miss for an unknown kid forces a JWKS re-fetch', async () => {
      const oldKey = generateRsaPair('key-old');
      const newKey = generateRsaPair('key-new');

      // Sequence: first fetch returns only the old key. After
      // we invalidate the cache (simulating WorkOS rotation),
      // the next fetch returns both keys.
      let phase = 0;
      const fn = (async () => {
        phase++;
        const keys = phase === 1 ? [oldKey.jwk] : [oldKey.jwk, newKey.jwk];
        return new Response(JSON.stringify({ keys }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as unknown as typeof fetch;

      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });

      // First verify caches the old key set
      const oldToken = signJwt(oldKey.privateKey, { alg: 'RS256', kid: 'key-old' }, validClaims());
      await expect(verifier.verify(oldToken)).resolves.not.toBeNull();
      expect(phase).toBe(1);

      // New token signed by key-new — kid not in cache, triggers re-fetch
      const newToken = signJwt(newKey.privateKey, { alg: 'RS256', kid: 'key-new' }, validClaims());
      await expect(verifier.verify(newToken)).resolves.not.toBeNull();
      expect(phase).toBe(2);
    });

    it('invalidateCache forces the next verify to refetch', async () => {
      const key = generateRsaPair('key-1');
      const { fn, callCount } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const token = signJwt(key.privateKey, { alg: 'RS256', kid: 'key-1' }, validClaims());
      await verifier.verify(token);
      verifier.invalidateCache();
      await verifier.verify(token);
      expect(callCount()).toBe(2);
    });
  });

  describe('asVerifyTokenFn', () => {
    it('returns a function bound to the verifier instance', async () => {
      const key = generateRsaPair('key-1');
      const { fn } = buildFetch([key]);
      const verifier = new WorkOSJwksVerifier({
        jwksUrl: JWKS_URL,
        expectedIssuer: ISSUER,
        expectedAudience: AUDIENCE,
        fetchImpl: fn,
      });
      const verifyFn = verifier.asVerifyTokenFn();
      const token = signJwt(key.privateKey, { alg: 'RS256', kid: 'key-1' }, validClaims());
      const claims = await verifyFn(token);
      expect(claims).not.toBeNull();
    });
  });
});
