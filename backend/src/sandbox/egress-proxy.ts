/**
 * Egress proxy for sandboxes whose workspace allows only listed hosts.
 *
 * Self-contained on purpose (node built-ins only): the sandbox-runner reads
 * this compiled file and runs it with `node -e` in a stock node image on the
 * rootless daemon, so no image has to be built or shipped there. Sandboxes
 * in allowlist mode sit on an `--internal` network whose only way out is
 * this proxy; HTTP(S)_PROXY carries a token, signed by the runner, that
 * lists the hosts that sandbox may reach and when the permission expires.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { lookup } from 'dns';
import { createServer, IncomingMessage, request, Server } from 'http';
import { connect, isIP, Socket } from 'net';

export interface EgressGrant {
  hosts: string[];
  /** Unix seconds. */
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signGrant(secret: string, grant: EgressGrant): string {
  const body = b64url(Buffer.from(JSON.stringify({ h: grant.hosts, e: grant.exp })));
  const mac = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifyGrant(secret: string, token: string, nowSec: number): EgressGrant | null {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = fromB64url(token.slice(dot + 1));
  const expected = createHmac('sha256', secret).update(body).digest();
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  try {
    const parsed = JSON.parse(fromB64url(body).toString('utf8')) as { h?: unknown; e?: unknown };
    if (!Array.isArray(parsed.h) || typeof parsed.e !== 'number') return null;
    if (parsed.e < nowSec) return null;
    return { hosts: parsed.h.filter((h): h is string => typeof h === 'string'), exp: parsed.e };
  } catch {
    return null;
  }
}

/** `api.github.com` matches `api.github.com` and `*.github.com`; never IPs. */
export function hostAllowed(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || isIP(h)) return false;
  return allowed.some(rule => {
    const r = rule.toLowerCase();
    if (r.startsWith('*.')) return h.endsWith(r.slice(1)) && h.length > r.length - 1;
    return h === r;
  });
}

const PRIVATE_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const;

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

/** Defence in depth: an allowed name that resolves to a private address is refused. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
    return (
      v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
    );
  }
  if (isIP(ip) !== 4) return true;
  const n = v4ToInt(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

const ALLOWED_PORTS = new Set([80, 443]);

export interface EgressProxyOptions {
  secret: string;
  now?: () => number;
  resolve?: (host: string) => Promise<string>;
  log?: (line: string) => void;
  /** Tests only: let allowed names resolve to loopback. */
  refusePrivate?: boolean;
}

function defaultResolve(host: string): Promise<string> {
  return new Promise((resolve, reject) =>
    lookup(host, { family: 4 }, (err, address) => (err ? reject(err) : resolve(address)))
  );
}

function grantFrom(req: IncomingMessage, opts: EgressProxyOptions): EgressGrant | null {
  const header = req.headers['proxy-authorization'];
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  const token = colon >= 0 ? decoded.slice(colon + 1) : decoded;
  return verifyGrant(opts.secret, token, Math.floor((opts.now ?? Date.now)() / 1000));
}

export function createEgressProxy(opts: EgressProxyOptions): Server {
  const resolve = opts.resolve ?? defaultResolve;
  const log = opts.log ?? (() => undefined);

  async function target(host: string, port: number, grant: EgressGrant | null): Promise<string> {
    if (!grant) throw Object.assign(new Error('proxy authentication required'), { status: 407 });
    if (!ALLOWED_PORTS.has(port))
      throw Object.assign(new Error(`port ${port} not allowed`), { status: 403 });
    if (!hostAllowed(host, grant.hosts)) {
      throw Object.assign(new Error(`${host} is not in this workspace's allowlist`), {
        status: 403,
      });
    }
    const address = await resolve(host);
    if (opts.refusePrivate !== false && isPrivateAddress(address)) {
      throw Object.assign(new Error(`${host} resolves to a private address`), { status: 403 });
    }
    return address;
  }

  const server = createServer((req, res) => {
    let url: URL;
    try {
      url = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end('absolute URL required\n');
      return;
    }
    if (url.protocol !== 'http:') {
      res.writeHead(400).end('use CONNECT for https\n');
      return;
    }
    const port = Number(url.port || 80);
    target(url.hostname, port, grantFrom(req, opts))
      .then(address => {
        log(`allow http ${url.hostname}:${port}`);
        const headers = { ...req.headers };
        delete headers['proxy-authorization'];
        delete headers['proxy-connection'];
        const upstream = request(
          {
            host: address,
            port,
            method: req.method,
            path: url.pathname + url.search,
            headers: { ...headers, host: url.host },
          },
          up => {
            res.writeHead(up.statusCode ?? 502, up.headers);
            up.pipe(res);
          }
        );
        upstream.on('error', err => {
          if (!res.headersSent) res.writeHead(502);
          res.end(`upstream error: ${err.message}\n`);
        });
        req.pipe(upstream);
      })
      .catch((err: Error & { status?: number }) => {
        log(`deny http ${url.hostname}:${port} ${err.message}`);
        const status = err.status ?? 502;
        res.writeHead(
          status,
          status === 407 ? { 'proxy-authenticate': 'Basic realm="operari"' } : {}
        );
        res.end(`${err.message}\n`);
      });
  });

  server.on('connect', (req: IncomingMessage, client: Socket, head: Buffer) => {
    const [host, portText] = (req.url ?? '').split(':');
    const port = Number(portText);
    target(host, port, grantFrom(req, opts))
      .then(address => {
        log(`allow connect ${host}:${port}`);
        const upstream = connect(port, address, () => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length) upstream.write(head);
          upstream.pipe(client);
          client.pipe(upstream);
        });
        const close = () => {
          upstream.destroy();
          client.destroy();
        };
        upstream.on('error', close);
        client.on('error', close);
      })
      .catch((err: Error & { status?: number }) => {
        log(`deny connect ${host}:${port} ${err.message}`);
        const status = err.status ?? 502;
        const reason =
          status === 407
            ? 'Proxy Authentication Required'
            : status === 403
              ? 'Forbidden'
              : 'Bad Gateway';
        client.end(
          `HTTP/1.1 ${status} ${reason}\r\n` +
            (status === 407 ? 'Proxy-Authenticate: Basic realm="operari"\r\n' : '') +
            `Content-Length: ${Buffer.byteLength(err.message + '\n')}\r\n\r\n${err.message}\n`
        );
      });
  });

  return server;
}

if (process.env.OPERARI_EGRESS_PROXY_MAIN === '1') {
  const secret = process.env.OPERARI_EGRESS_SECRET ?? '';
  if (secret.length < 32) {
    console.error('OPERARI_EGRESS_SECRET must be at least 32 characters');
    process.exit(1);
  }
  createEgressProxy({ secret, log: line => console.warn(line) }).listen(3128, '0.0.0.0', () =>
    console.warn('operari egress proxy on :3128')
  );
}
