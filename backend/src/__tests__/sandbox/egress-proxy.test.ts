import { createServer, request, Server } from 'http';
import { AddressInfo, connect } from 'net';

import {
  createEgressProxy,
  hostAllowed,
  isPrivateAddress,
  signGrant,
  verifyGrant,
} from '../../sandbox/egress-proxy';

const SECRET = 's'.repeat(64);
const NOW = 1_800_000_000;

describe('egress grants', () => {
  it('round-trips and rejects tampering, other secrets and expiry', () => {
    const token = signGrant(SECRET, { hosts: ['pypi.org'], exp: NOW + 60 });
    expect(verifyGrant(SECRET, token, NOW)).toEqual({ hosts: ['pypi.org'], exp: NOW + 60 });
    expect(verifyGrant('x'.repeat(64), token, NOW)).toBeNull();
    expect(verifyGrant(SECRET, token, NOW + 61)).toBeNull();
    const [body, mac] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ h: ['*.com'], e: NOW + 60 }))
      .toString('base64')
      .replace(/=+$/, '');
    expect(verifyGrant(SECRET, `${forged}.${mac}`, NOW)).toBeNull();
    expect(verifyGrant(SECRET, body, NOW)).toBeNull();
  });

  it('matches exact hosts and wildcard subdomains, never IPs', () => {
    const rules = ['pypi.org', '*.github.com'];
    expect(hostAllowed('pypi.org', rules)).toBe(true);
    expect(hostAllowed('PyPI.org.', rules)).toBe(true);
    expect(hostAllowed('files.pypi.org', rules)).toBe(false);
    expect(hostAllowed('api.github.com', rules)).toBe(true);
    expect(hostAllowed('github.com', rules)).toBe(false);
    expect(hostAllowed('evilgithub.com', rules)).toBe(false);
    expect(hostAllowed('1.2.3.4', ['1.2.3.4'])).toBe(false);
  });

  it('classifies private addresses', () => {
    for (const ip of ['10.1.2.3', '172.19.0.1', '192.168.1.1', '127.0.0.1', '169.254.169.254', '::1', '::ffff:10.0.0.1', 'fd00::1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['1.1.1.1', '151.101.0.223', '172.32.0.1']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});

describe('egress proxy', () => {
  let upstream: Server;
  let proxy: Server;
  let upstreamPort: number;
  let proxyPort: number;
  const auth = (hosts: string[], exp = NOW + 60) =>
    'Basic ' + Buffer.from(`operari:${signGrant(SECRET, { hosts, exp })}`).toString('base64');

  beforeAll(async () => {
    upstream = createServer((req, res) => res.end(`hello ${req.headers.host} ${req.url}`));
    await new Promise<void>(r => upstream.listen(0, '127.0.0.1', r));
    upstreamPort = (upstream.address() as AddressInfo).port;
    proxy = createEgressProxy({
      secret: SECRET,
      now: () => NOW * 1000,
      resolve: async host => (host === 'private.example.com' ? '10.0.0.5' : '127.0.0.1'),
      refusePrivate: false,
    });
    await new Promise<void>(r => proxy.listen(0, '127.0.0.1', r));
    proxyPort = (proxy.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise(r => upstream.close(r));
    await new Promise(r => proxy.close(r));
  });

  const viaProxy = (url: string, header?: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port: proxyPort,
          path: url,
          headers: header ? { 'proxy-authorization': header } : {},
        },
        res => {
          let body = '';
          res.on('data', c => (body += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        }
      );
      req.on('error', reject);
      req.end();
    });

  const connectVia = (target: string, header?: string) =>
    new Promise<string>((resolve, reject) => {
      const sock = connect(proxyPort, '127.0.0.1', () => {
        sock.write(
          `CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n` +
            (header ? `Proxy-Authorization: ${header}\r\n` : '') +
            '\r\n'
        );
      });
      let data = '';
      sock.on('data', c => {
        data += c.toString();
        if (data.includes('\r\n\r\n')) {
          sock.destroy();
          resolve(data.split('\r\n')[0]);
        }
      });
      sock.on('error', reject);
    });

  it('needs a valid grant', async () => {
    expect((await viaProxy('http://pypi.org/simple')).status).toBe(407);
    expect((await viaProxy('http://pypi.org/simple', auth(['pypi.org'], NOW - 1))).status).toBe(407);
  });

  it('refuses hosts outside the grant and ports other than 80/443', async () => {
    expect((await viaProxy('http://example.com/', auth(['pypi.org']))).status).toBe(403);
    expect(await connectVia('pypi.org:22', auth(['pypi.org']))).toMatch(/^HTTP\/1.1 403/);
    expect(await connectVia('example.com:443', auth(['pypi.org']))).toMatch(/^HTTP\/1.1 403/);
  });

  it('opens a tunnel for an allowed host', async () => {
    expect(await connectVia('pypi.org:443', auth(['pypi.org']))).toBe(
      'HTTP/1.1 200 Connection Established'
    );
  });

  it('refuses plain http to non-standard ports even for allowed hosts', async () => {
    expect((await viaProxy(`http://pypi.org:${upstreamPort}/`, auth(['pypi.org']))).status).toBe(403);
  });
});

describe('egress proxy private resolution', () => {
  it('refuses an allowed name that resolves to a private address', async () => {
    const proxy = createEgressProxy({ secret: SECRET, now: () => NOW * 1000, resolve: async () => '10.0.0.5' });
    await new Promise<void>(r => proxy.listen(0, '127.0.0.1', r));
    const port = (proxy.address() as AddressInfo).port;
    const status = await new Promise<string>((resolve, reject) => {
      const sock = connect(port, '127.0.0.1', () =>
        sock.write(
          `CONNECT internal.example.com:443 HTTP/1.1\r\nProxy-Authorization: Basic ${Buffer.from(
            `operari:${signGrant(SECRET, { hosts: ['internal.example.com'], exp: NOW + 60 })}`
          ).toString('base64')}\r\n\r\n`
        )
      );
      sock.on('data', c => {
        sock.destroy();
        resolve(c.toString().split('\r\n')[0]);
      });
      sock.on('error', reject);
    });
    expect(status).toMatch(/^HTTP\/1.1 403/);
    await new Promise(r => proxy.close(r));
  });
});
