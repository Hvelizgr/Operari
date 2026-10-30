import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for the HTTP tester endpoint.
 *
 * The runbook engine itself does NOT apply this filter — runbooks
 * legitimately target internal services (`kubectl proxy`, in-cluster
 * health checks, the cloud metadata endpoint when an SRE is debugging
 * an IAM role). The HTTP tester is different: it's reachable by every
 * authenticated team member and we don't want a curious junior to
 * accidentally hit `169.254.169.254` and exfil cloud creds, or scan
 * the internal network from the browser-facing playground.
 *
 * Self-host operators who run Operari inside their own VPC and want
 * to exercise internal endpoints from the tester can flip
 * `OPERARI_HTTP_TESTER_ALLOW_PRIVATE=true`; the guard then becomes a
 * no-op and the playground inherits the same reach as the runbook
 * engine. Default is the safe one.
 */

export type SsrfBlockReason =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'private-ip'
  | 'loopback'
  | 'link-local'
  | 'cloud-metadata'
  | 'dns-failed';

export interface SsrfDecision {
  allowed: boolean;
  reason?: SsrfBlockReason;
  message?: string;
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const CLOUD_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inRange(ip: number, start: string, end: string): boolean {
  return ip >= ipv4ToInt(start) && ip <= ipv4ToInt(end);
}

function classifyIPv4(ip: string): SsrfBlockReason | null {
  const n = ipv4ToInt(ip);
  if (n === -1) return null;
  if (inRange(n, '127.0.0.0', '127.255.255.255')) return 'loopback';
  if (inRange(n, '10.0.0.0', '10.255.255.255')) return 'private-ip';
  if (inRange(n, '172.16.0.0', '172.31.255.255')) return 'private-ip';
  if (inRange(n, '192.168.0.0', '192.168.255.255')) return 'private-ip';
  if (inRange(n, '169.254.0.0', '169.254.255.255')) return 'link-local';
  if (inRange(n, '0.0.0.0', '0.255.255.255')) return 'private-ip';
  if (inRange(n, '224.0.0.0', '239.255.255.255')) return 'private-ip';
  return null;
}

function classifyIPv6(ip: string): SsrfBlockReason | null {
  // Strip a zone-id suffix if present (`fe80::1%eth0`); only the
  // address half matters for classification.
  const lower = ip.toLowerCase().split('%')[0];
  if (lower === '::1') return 'loopback';
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return 'link-local';
  if (lower.startsWith('fc') || lower.startsWith('fd')) return 'private-ip'; // unique-local fc00::/7
  // Deprecated site-local (RFC3879) — still routable on some networks
  // and worth blocking the same way as private-ip.
  if (
    lower.startsWith('fec') ||
    lower.startsWith('fed') ||
    lower.startsWith('fee') ||
    lower.startsWith('fef')
  ) {
    return 'private-ip';
  }
  // Multicast (ff00::/8). Same defensive posture as IPv4 multicast.
  if (lower.startsWith('ff')) return 'private-ip';
  if (lower === '::' || lower === '::ffff:0:0') return 'private-ip';
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — re-classify the embedded v4.
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return classifyIPv4(v4Mapped[1]);
  return null;
}

export function isPrivateIp(ip: string): SsrfBlockReason | null {
  const family = isIP(ip);
  if (family === 4) return classifyIPv4(ip);
  if (family === 6) return classifyIPv6(ip);
  return null;
}

/**
 * Check a URL against the SSRF policy. Resolves the hostname via DNS
 * and rejects if any resolved address is private/loopback/link-local
 * or matches a known cloud metadata endpoint. The DNS lookup happens
 * here so we catch DNS rebinding tricks where the hostname looks
 * public but resolves to 127.0.0.1.
 *
 * NOTE: there's a small TOCTOU window between this check and the
 * actual fetch — a hostile DNS could return a public IP for the
 * lookup and a private one for the request. The risk is acceptable
 * for an authenticated, rate-limited, audited team-facing tool.
 * Closing it fully requires custom socket binding (resolve once,
 * connect to the resolved IP) which we can ship later if needed.
 */
/**
 * Single-tenant self-hosts point runbooks at their own private network on
 * purpose; a shared deployment must not let tenants reach its internals.
 */
export function privateTargetsAllowed(): boolean {
  return (
    process.env.OPERARI_ALLOW_PRIVATE_TARGETS === 'true' ||
    process.env.OPERARI_HTTP_TESTER_ALLOW_PRIVATE === 'true'
  );
}

export async function checkUrlSafe(rawUrl: string): Promise<SsrfDecision> {
  if (privateTargetsAllowed()) {
    return { allowed: true };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      allowed: false,
      reason: 'invalid-url',
      message: 'URL is malformed',
    };
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return {
      allowed: false,
      reason: 'unsupported-scheme',
      message: `Only http: and https: are allowed (got ${url.protocol})`,
    };
  }

  return checkHostSafe(url.hostname);
}

/** Same checks as {@link checkUrlSafe} for non-HTTP targets (redis, smtp, postgres, ssh). */
export async function checkHostSafe(rawHost: string): Promise<SsrfDecision> {
  if (privateTargetsAllowed()) {
    return { allowed: true };
  }
  const hostname = rawHost.toLowerCase().replace(/^\[|\]$/g, '');

  if (CLOUD_METADATA_HOSTS.has(hostname)) {
    return {
      allowed: false,
      reason: 'cloud-metadata',
      message: 'Cloud metadata endpoints are not reachable from the HTTP tester',
    };
  }

  // If the hostname is already a literal IP, classify directly.
  const literalReason = isPrivateIp(hostname);
  if (literalReason) {
    return {
      allowed: false,
      reason: literalReason,
      message: `${hostname} is a ${literalReason} address`,
    };
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return {
      allowed: false,
      reason: 'loopback',
      message: `${hostname} resolves to a loopback address`,
    };
  }

  // Resolve DNS — `lookup` returns every A/AAAA record so a hostname
  // that fans out to (1.2.3.4, 127.0.0.1) gets caught.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return {
      allowed: false,
      reason: 'dns-failed',
      message: `Could not resolve ${hostname}`,
    };
  }

  for (const { address } of addresses) {
    if (CLOUD_METADATA_HOSTS.has(address)) {
      return {
        allowed: false,
        reason: 'cloud-metadata',
        message: `${hostname} resolves to a cloud metadata endpoint`,
      };
    }
    const reason = isPrivateIp(address);
    if (reason) {
      return {
        allowed: false,
        reason,
        message: `${hostname} resolves to ${address} (${reason})`,
      };
    }
  }

  return { allowed: true };
}

/** Error message for a blocked target, or null when it may be reached. */
export async function blockedTarget(kind: 'url' | 'host', target: string): Promise<string | null> {
  const decision = kind === 'url' ? await checkUrlSafe(target) : await checkHostSafe(target);
  if (decision.allowed) return null;
  return `blocked: ${decision.message ?? decision.reason}. Private and internal addresses are not reachable from runbook steps on this server.`;
}

/**
 * fetch that re-checks every redirect hop, since a public URL can 302 to an
 * internal one. Falls back to plain fetch when private targets are allowed.
 */
export async function guardedFetch(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  maxRedirects = 5
): Promise<Response> {
  if (privateTargetsAllowed()) return fetchFn(url, init);
  const followRedirects = init.redirect !== 'manual';
  let current = url;
  let currentInit = init;
  for (let hop = 0; ; hop++) {
    const blocked = await blockedTarget('url', current);
    if (blocked) throw new Error(blocked);
    const res = await fetchFn(current, { ...currentInit, redirect: 'manual' });
    if (!followRedirects || res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    if (!location) return res;
    if (hop >= maxRedirects) throw new Error(`too many redirects (>${maxRedirects})`);
    current = new URL(location, current).toString();
    if (
      res.status === 303 ||
      ((res.status === 301 || res.status === 302) && currentInit.method === 'POST')
    ) {
      currentInit = { ...currentInit, method: 'GET', body: undefined };
    }
  }
}
