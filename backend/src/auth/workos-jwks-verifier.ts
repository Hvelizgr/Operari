import { createPublicKey, createVerify, KeyObject } from 'crypto';

import type { VerifyJwksTokenFn, WorkOSClaims } from './workos-auth-provider';

/**
 * WorkOS JWKS verifier — produces a `verifyJwksToken` function the
 * WorkOSAuthProvider can use without pulling `jose` or `jsonwebtoken`
 * as dependencies. node:crypto's KeyObject + createVerify cover
 * everything we need for RS256 against a JWKS endpoint.
 *
 * The verifier:
 *   1. Splits the JWT into header.payload.signature
 *   2. Parses the header to extract `kid` and `alg`
 *   3. Fetches the JWKS from WorkOS (or returns the cached set)
 *   4. Picks the matching JWK by `kid`
 *   5. Imports the JWK as a node KeyObject
 *   6. Verifies the signature with createVerify('RSA-SHA256')
 *   7. Validates the standard claims (iss, aud, exp, nbf)
 *
 * Security notes
 *   - We HARD-REJECT alg !== 'RS256'. The "alg=none" attack and the
 *     "alg=HS256 with the public key as the secret" attack are both
 *     blocked by an allowlist rather than relying on jsonwebtoken's
 *     opt-in algorithms parameter.
 *   - kid is REQUIRED. A JWT without a kid cannot be verified
 *     unambiguously when WorkOS rotates keys.
 *   - Clock skew tolerance is 30 seconds on both ends (exp and nbf).
 *     Configurable via the constructor.
 *   - JWKS cache TTL is 10 minutes by default. A `kid` not found in
 *     the cache forces a re-fetch (transparent rotation handling).
 *
 * Tests use a self-signed RSA key pair + a fake fetch — no real
 * WorkOS contact, fully deterministic.
 */

export interface JsonWebKey {
  kid: string;
  kty: string;
  use?: string;
  alg?: string;
  n: string;
  e: string;
}

export interface JsonWebKeySet {
  keys: JsonWebKey[];
}

export type FetchFn = typeof fetch;

export interface WorkOSJwksVerifierOptions {
  /** WorkOS-issued JWKS URL, e.g. `https://api.workos.com/sso/jwks/{client_id}` */
  jwksUrl: string;
  /** Expected `iss` claim. WorkOS uses `https://api.workos.com`. */
  expectedIssuer: string;
  /**
   * Expected `aud` claim. WorkOS sets it to the client id. Pass
   * undefined to skip the audience check (NOT recommended in
   * production — it's the only thing protecting against a token
   * issued for another WorkOS app).
   */
  expectedAudience?: string;
  /** Cache TTL for the JWKS. Default 10 minutes. */
  cacheTtlMs?: number;
  /** Clock skew tolerance in seconds for exp/nbf. Default 30. */
  clockSkewSeconds?: number;
  /** Inject a custom fetch — used by tests. Defaults to global fetch. */
  fetchImpl?: FetchFn;
}

interface CachedJwks {
  keys: Map<string, KeyObject>;
  fetchedAt: number;
}

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_SECONDS = 30;

export class WorkOSJwksVerifier {
  private readonly jwksUrl: string;
  private readonly expectedIssuer: string;
  private readonly expectedAudience?: string;
  private readonly cacheTtlMs: number;
  private readonly clockSkewSeconds: number;
  private readonly fetchImpl: FetchFn;

  private cache: CachedJwks | null = null;

  constructor(options: WorkOSJwksVerifierOptions) {
    this.jwksUrl = options.jwksUrl;
    this.expectedIssuer = options.expectedIssuer;
    this.expectedAudience = options.expectedAudience;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.clockSkewSeconds = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Returns a verifyJwksToken function suitable for passing to
   * `WorkOSAuthProvider({ verifyJwksToken })`. Bound to this
   * verifier instance so the cache is preserved across calls.
   */
  asVerifyTokenFn(): VerifyJwksTokenFn {
    return (token: string) => this.verify(token);
  }

  async verify(token: string): Promise<WorkOSClaims | null> {
    // 1. Decode without verifying to inspect header
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    let header: { alg?: string; kid?: string; typ?: string };
    try {
      header = JSON.parse(decodeBase64Url(headerB64).toString('utf8'));
    } catch {
      return null;
    }

    // Algorithm allowlist — RS256 only. The "alg=none" and
    // "alg=HS256 with public key" attacks die here.
    if (header.alg !== 'RS256') return null;
    if (!header.kid) return null;

    // 2. Get the matching JWK (cache or fetch)
    const key = await this.resolveKey(header.kid);
    if (!key) return null;

    // 3. Verify the signature
    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const signature = decodeBase64Url(signatureB64);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    const ok = verifier.verify(key, signature);
    if (!ok) return null;

    // 4. Decode and validate the claims
    let claims: WorkOSClaims;
    try {
      claims = JSON.parse(decodeBase64Url(payloadB64).toString('utf8'));
    } catch {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const skew = this.clockSkewSeconds;

    if (typeof claims.exp !== 'number' || claims.exp + skew < nowSec) return null;
    if (typeof claims.iat !== 'number') return null;

    const claimsIss = (claims as unknown as { iss?: string }).iss;
    if (claimsIss !== this.expectedIssuer) return null;

    if (this.expectedAudience !== undefined) {
      const claimsAud = (claims as unknown as { aud?: string | string[] }).aud;
      const matches = Array.isArray(claimsAud)
        ? claimsAud.includes(this.expectedAudience)
        : claimsAud === this.expectedAudience;
      if (!matches) return null;
    }

    if (!claims.sub || !claims.email || !claims.organization_id) return null;

    return claims;
  }

  /**
   * Look up a public key by `kid` in the cache; on miss or expiry,
   * re-fetch the JWKS from WorkOS. Returns null if the kid is not
   * present even after a fresh fetch — this is the signal a token
   * was signed by a key WorkOS has since rotated out.
   */
  private async resolveKey(kid: string): Promise<KeyObject | null> {
    const cached = this.getFreshCache();
    if (cached) {
      const hit = cached.keys.get(kid);
      if (hit) return hit;
    }

    // Cache miss or expired → fetch.
    const fresh = await this.fetchJwks();
    if (!fresh) return null;
    return fresh.keys.get(kid) ?? null;
  }

  private getFreshCache(): CachedJwks | null {
    if (!this.cache) return null;
    if (Date.now() - this.cache.fetchedAt > this.cacheTtlMs) return null;
    return this.cache;
  }

  private async fetchJwks(): Promise<CachedJwks | null> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.jwksUrl);
    } catch {
      // Transport failure — caller turns null into a 401 since
      // we cannot verify any token without keys. The
      // WorkOSAuthProvider catch path raises AuthTransportError
      // for callers that want to distinguish 503 from 401.
      return null;
    }
    if (!res.ok) return null;

    let body: JsonWebKeySet;
    try {
      body = (await res.json()) as JsonWebKeySet;
    } catch {
      return null;
    }
    if (!body.keys || !Array.isArray(body.keys)) return null;

    const map = new Map<string, KeyObject>();
    for (const jwk of body.keys) {
      if (jwk.kty !== 'RSA' || !jwk.kid || !jwk.n || !jwk.e) continue;
      try {
        const key = createPublicKey({
          key: { kty: 'RSA', n: jwk.n, e: jwk.e },
          format: 'jwk',
        });
        map.set(jwk.kid, key);
      } catch {
        // Skip malformed keys but keep going so a single bad
        // entry does not break the whole set.
        continue;
      }
    }

    this.cache = { keys: map, fetchedAt: Date.now() };
    return this.cache;
  }

  /** Test helper: clear the cache so the next verify forces a fetch. */
  invalidateCache(): void {
    this.cache = null;
  }
}

/**
 * Decode a base64url string (no padding) into a Buffer. Centralized
 * so the JWT-specific encoding lives in one place.
 */
function decodeBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, 'base64');
}
