import { createHash } from 'crypto';

/**
 * Have I Been Pwned password check (k-anonymity API).
 *
 * Protocol summary (https://haveibeenpwned.com/API/v3#PwnedPasswords):
 *   1. SHA-1 the password in the caller process.
 *   2. Send only the first 5 hex chars of the hash to
 *      https://api.pwnedpasswords.com/range/{prefix}.
 *   3. HIBP returns every full hash matching that prefix, with
 *      occurrence counts. We scan locally for the remaining 35 chars.
 * The password itself never leaves our process. The prefix leaks ~1
 * bit of information, which is fine.
 *
 * Fail-open contract: if HIBP is slow, rate-limits us, or times out,
 * we return `{ breached: false }` and log. A credential check outage
 * must NOT block signups — the 99th-percentile user has never heard
 * of HIBP and shouldn't be blocked by it.
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range';
const DEFAULT_TIMEOUT_MS = 1500;

export interface BreachCheckResult {
  breached: boolean;
  /**
   * How many times the password appeared in the HIBP dataset.
   * `0` for non-breached. `undefined` when the check failed
   * entirely (network / timeout / non-2xx) — the caller should
   * treat undefined as "unknown" and allow the password through.
   */
  occurrences?: number;
}

export interface CheckBreachedOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * Minimum occurrence count that counts as "breached". Default is
   * 1 (any appearance). Raise to a higher number (e.g., 100) if you
   * want to allow common-but-not-egregious passwords for internal
   * tools. Configurable via OPERARI_PASSWORD_BREACH_THRESHOLD.
   */
  threshold?: number;
}

function envThreshold(): number {
  const raw = process.env.OPERARI_PASSWORD_BREACH_THRESHOLD;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

export async function checkBreachedPassword(
  password: string,
  options: CheckBreachedOptions = {}
): Promise<BreachCheckResult> {
  if (!password || typeof password !== 'string') {
    return { breached: false, occurrences: 0 };
  }
  // Skip the network call entirely in self-host + explicit opt-out.
  // The HIBP API is public but makes an external HTTP call on every
  // register; an operator behind an egress firewall may not want it.
  if (process.env.OPERARI_PASSWORD_BREACH_CHECK === 'false') {
    return { breached: false };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const threshold = options.threshold ?? envThreshold();

  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${HIBP_RANGE_URL}/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return { breached: false };
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [suf, countRaw] = line.trim().split(':');
      if (!suf || !countRaw) continue;
      if (suf === suffix) {
        const count = Number.parseInt(countRaw, 10);
        if (Number.isFinite(count) && count >= threshold) {
          return { breached: true, occurrences: count };
        }
        return { breached: false, occurrences: count };
      }
    }
    return { breached: false, occurrences: 0 };
  } catch {
    return { breached: false };
  } finally {
    clearTimeout(timer);
  }
}
