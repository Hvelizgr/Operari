import { promises as dns } from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';

import { blockedTarget, guardedFetch } from '../../security/ssrf-guard';
import { type CatalogNode, fail, MAIN, ok } from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'network',
  icon,
  color: 'bg-cyan-700',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const host = {
  name: 'host',
  displayName: 'Host',
  type: 'string' as const,
  required: true,
  typeOptions: { expression: true },
};
const timeout = {
  name: 'timeout',
  displayName: 'Timeout (ms)',
  type: 'number' as const,
  default: 5000,
};
const failWhenDown = {
  name: 'failWhenDown',
  displayName: 'Fail the step when the check fails',
  type: 'boolean' as const,
  default: false,
  description: 'Off → the step succeeds and reports up: false, so a later If can branch on it.',
};

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

export const NETWORK_NODES: CatalogNode[] = [
  {
    ...meta(
      'operari.dns',
      'Globe2',
      ['DNS lookup', 'Consulta DNS'],
      [
        'Resolve A, AAAA, CNAME, MX, TXT, NS, SRV or CAA records',
        'Resolver registros A, AAAA, CNAME, MX, TXT, NS, SRV o CAA',
      ]
    ),
    properties: [
      { ...host, displayName: 'Name' },
      {
        name: 'recordType',
        displayName: 'Record type',
        type: 'options',
        default: 'A',
        options: RECORD_TYPES.map(r => ({ name: r, value: r })),
      },
    ],
    run: async t => {
      const name = t.str('host');
      const blocked = await blockedTarget('host', name);
      if (blocked) return fail(`dns: ${blocked}`);
      const type = t.str('recordType');
      if (!RECORD_TYPES.includes(type)) return fail(`unsupported record type "${type}"`);
      try {
        const records = await dns.resolve(name, type as 'A');
        return ok({ name, type, records, found: records.length > 0 });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENODATA' || code === 'ENOTFOUND')
          return ok({ name, type, records: [], found: false });
        return fail(`dns: ${(err as Error).message}`);
      }
    },
  },
  {
    ...meta(
      'operari.tcpCheck',
      'Plug',
      ['TCP port check', 'Chequeo de puerto TCP'],
      [
        'Check whether a host accepts connections on a port, and how fast',
        'Comprobar si un host acepta conexiones en un puerto, y en cuánto tiempo',
      ]
    ),
    properties: [
      host,
      { name: 'port', displayName: 'Port', type: 'number', required: true, default: 443 },
      timeout,
      failWhenDown,
    ],
    run: async t => {
      const h = t.str('host');
      const port = t.num('port');
      const blocked = await blockedTarget('host', h);
      if (blocked) return fail(`tcpCheck: ${blocked}`);
      const started = Date.now();
      const result = await new Promise<{ up: boolean; error?: string }>(resolve => {
        const socket = net.connect({ host: h, port, timeout: t.num('timeout') });
        socket.once('connect', () => {
          socket.destroy();
          resolve({ up: true });
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve({ up: false, error: 'timed out' });
        });
        socket.once('error', err => resolve({ up: false, error: err.message }));
      });
      const output = {
        host: h,
        port,
        up: result.up,
        latencyMs: Date.now() - started,
        error: result.error ?? null,
      };
      if (!result.up && t.bool('failWhenDown'))
        return fail(`${h}:${port} is down: ${result.error}`);
      return ok(output);
    },
  },
  {
    ...meta(
      'operari.tlsCheck',
      'ShieldCheck',
      ['TLS certificate check', 'Chequeo de certificado TLS'],
      [
        'Read a server certificate: issuer, expiry date and days left',
        'Leer el certificado de un servidor: emisor, vencimiento y días restantes',
      ]
    ),
    properties: [
      host,
      { name: 'port', displayName: 'Port', type: 'number', default: 443 },
      {
        name: 'minDays',
        displayName: 'Warn below (days)',
        type: 'number',
        default: 14,
        description: 'Sets expiringSoon when fewer days remain.',
      },
      timeout,
      failWhenDown,
    ],
    run: async t => {
      const h = t.str('host');
      const port = t.num('port');
      const blocked = await blockedTarget('host', h);
      if (blocked) return fail(`tlsCheck: ${blocked}`);
      const result = await new Promise<{
        cert?: tls.PeerCertificate;
        authorized: boolean;
        error?: string;
      }>(resolve => {
        const socket = tls.connect({
          host: h,
          port,
          servername: h,
          rejectUnauthorized: false,
          timeout: t.num('timeout'),
        });
        socket.once('secureConnect', () => {
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;
          const error = socket.authorizationError ? String(socket.authorizationError) : undefined;
          socket.end();
          resolve({ cert, authorized, error });
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve({ authorized: false, error: 'timed out' });
        });
        socket.once('error', err => resolve({ authorized: false, error: err.message }));
      });
      if (!result.cert || !result.cert.valid_to) {
        if (t.bool('failWhenDown')) return fail(`tlsCheck: ${result.error ?? 'no certificate'}`);
        return ok({ host: h, port, valid: false, error: result.error ?? 'no certificate' });
      }
      const expires = new Date(result.cert.valid_to);
      const daysRemaining = Math.floor((expires.getTime() - Date.now()) / 86_400_000);
      const output = {
        host: h,
        port,
        valid: result.authorized && daysRemaining >= 0,
        error: result.error ?? null,
        subject: result.cert.subject?.CN ?? null,
        issuer: result.cert.issuer?.O ?? result.cert.issuer?.CN ?? null,
        validFrom: new Date(result.cert.valid_from).toISOString(),
        validTo: expires.toISOString(),
        daysRemaining,
        expiringSoon: daysRemaining < t.num('minDays'),
        altNames: (result.cert.subjectaltname ?? '')
          .split(', ')
          .filter(Boolean)
          .map(s => s.replace(/^DNS:/, '')),
      };
      if (!output.valid && t.bool('failWhenDown')) {
        return fail(
          `tlsCheck: certificate for ${h} is not valid (${output.error ?? `expired ${output.validTo}`})`
        );
      }
      return ok(output);
    },
  },
  {
    ...meta(
      'operari.httpCheck',
      'HeartPulse',
      ['HTTP health check', 'Chequeo HTTP de salud'],
      [
        'Request a URL and check the status code, response time and content',
        'Pedir una URL y comprobar el código de estado, el tiempo de respuesta y el contenido',
      ]
    ),
    properties: [
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      { name: 'expectedStatus', displayName: 'Expected status', type: 'number', default: 200 },
      {
        name: 'contains',
        displayName: 'Body must contain',
        type: 'string',
        description: 'Optional text the response body must include.',
      },
      {
        name: 'maxLatencyMs',
        displayName: 'Max response time (ms)',
        type: 'number',
        default: 0,
        description: '0 = no limit.',
      },
      timeout,
      failWhenDown,
    ],
    run: async t => {
      const url = t.str('url');
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), t.num('timeout'));
      let status = 0;
      let body = '';
      let error: string | null = null;
      try {
        const res = await guardedFetch(t.fetch, url, { method: 'GET', signal: controller.signal });
        status = res.status;
        body = await res.text();
      } catch (err) {
        error =
          err instanceof Error && err.name === 'AbortError' ? 'timed out' : (err as Error).message;
      } finally {
        clearTimeout(timer);
      }
      const latencyMs = Date.now() - started;
      const contains = t.str('contains');
      const maxLatency = t.num('maxLatencyMs');
      const reasons = [
        error,
        !error && status !== t.num('expectedStatus')
          ? `status ${status}, expected ${t.num('expectedStatus')}`
          : null,
        !error && contains && !body.includes(contains)
          ? `body does not contain "${contains}"`
          : null,
        !error && maxLatency > 0 && latencyMs > maxLatency
          ? `took ${latencyMs}ms, limit ${maxLatency}ms`
          : null,
      ].filter((r): r is string => !!r);
      const up = reasons.length === 0;
      if (!up && t.bool('failWhenDown')) return fail(`httpCheck ${url}: ${reasons.join('; ')}`);
      return ok({ url, up, status, latencyMs, reasons });
    },
  },
];
