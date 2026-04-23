import { redisConfig } from '../config/redis.config';

/**
 * JWT denylist for session revocation.
 *
 * Stateless JWTs can't be invalidated mid-flight by construction.
 * To give logout real teeth, we record the JTI (unique token id) in
 * Redis with a TTL matching the token's own exp claim. The JWT auth
 * provider checks the denylist after a successful signature verify.
 *
 * Without Redis this is a no-op — tokens remain valid until their
 * natural exp. That's the honest self-host tradeoff: operators who
 * need revocation run Redis (it's in docker-compose by default), and
 * those who don't still get the correct stateless behavior.
 */

const KEY_PREFIX = 'auth:denylist:';

export async function revokeJti(jti: string, expirySeconds: number): Promise<void> {
  const client = redisConfig.getClient();
  if (!client || !redisConfig.isReady()) return;
  const ttl = Math.max(1, Math.floor(expirySeconds));
  await client.set(`${KEY_PREFIX}${jti}`, '1', 'EX', ttl);
}

export async function isJtiRevoked(jti: string): Promise<boolean> {
  const client = redisConfig.getClient();
  if (!client || !redisConfig.isReady()) return false;
  const value = await client.get(`${KEY_PREFIX}${jti}`);
  return value !== null;
}
