const queries: string[] = [];
jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: {
    createConnection: jest.fn(async () => ({
      query: jest.fn(async (q: string | { sql: string }) => {
        queries.push(typeof q === 'string' ? q : q.sql);
        return typeof q === 'string' ? [[], []] : [[{ id: 1 }, { id: 2 }], [{ name: 'id' }]];
      }),
      end: jest.fn(async () => undefined),
    })),
  },
}));

import { S3Client } from '@aws-sdk/client-s3';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { BUILTIN_CATALOG, CatalogExecutor } from '../../../runbook/catalog';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

const byType = (type: string) => BUILTIN_CATALOG.find(n => n.type === type)!;
const ctx = (over: Partial<ExecutorContext> = {}): ExecutorContext => ({
  runId: 'run-1',
  stepId: 'step-1',
  variables: {},
  previousOutputs: {},
  tenantId: 't-1',
  ...over,
});

describe('mysql.query', () => {
  beforeEach(() => (queries.length = 0));

  it('wraps the query in a READ ONLY transaction by default', async () => {
    const res = await new CatalogExecutor(byType('mysql.query')).execute(
      {
        connection: 'mysql://u:p@db.example.com:3306/app',
        query: 'SELECT id FROM t WHERE x = ?',
        params: '[1]',
      },
      ctx()
    );
    expect(res.output).toMatchObject({ rowCount: 2, columns: ['id'] });
    expect(queries).toEqual([
      'START TRANSACTION READ ONLY',
      'SELECT id FROM t WHERE x = ?',
      'COMMIT',
    ]);
  });

  it('does not connect in a dry run', async () => {
    const res = await new CatalogExecutor(byType('mysql.query')).execute(
      { connection: 'mysql://u:p@db.example.com/app', query: 'DELETE FROM t' },
      ctx({ dryRun: true })
    );
    expect(res.output).toMatchObject({ dryRun: true });
    expect(queries).toHaveLength(0);
  });

  it('is blocked from private hosts on a shared server', async () => {
    process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'false';
    try {
      const res = await new CatalogExecutor(byType('mysql.query')).execute(
        { connection: 'mysql://u:p@10.0.0.4/app', query: 'SELECT 1' },
        ctx()
      );
      expect(res.error).toMatch(/blocked/);
    } finally {
      process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'true';
    }
  });
});

describe('mongodb.action', () => {
  it('is blocked from private hosts on a shared server', async () => {
    process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'false';
    try {
      const blocked = await new CatalogExecutor(byType('mongodb.action')).execute(
        { uri: 'mongodb://10.0.0.5:27017', database: 'd', collection: 'c' },
        ctx()
      );
      expect(blocked.error).toMatch(/blocked/);
    } finally {
      process.env.OPERARI_ALLOW_PRIVATE_TARGETS = 'true';
    }
  });
});

describe('aws.s3', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists objects with the given prefix and region', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockImplementation((async () => ({
      Contents: [{ Key: 'logs/a.txt', Size: 3 }],
      IsTruncated: false,
    })) as never);
    const res = await new CatalogExecutor(byType('aws.s3')).execute(
      { accessKeyId: 'AKID', secretAccessKey: 's', region: 'eu-west-1', bucket: 'b', key: 'logs/' },
      ctx()
    );
    expect(res.output).toMatchObject({ count: 1, objects: [{ key: 'logs/a.txt', size: 3 }] });
    const cmd = send.mock.calls[0][0] as unknown as { input: Record<string, unknown> };
    expect(cmd.input).toMatchObject({ Bucket: 'b', Prefix: 'logs/' });
  });

  it('rejects a malformed region', async () => {
    const res = await new CatalogExecutor(byType('aws.s3')).execute(
      { accessKeyId: 'AKID', secretAccessKey: 's', region: 'nowhere', bucket: 'b' },
      ctx()
    );
    expect(res.error).toMatch(/not an AWS region/);
  });
});

describe('google.sheets', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const sa = JSON.stringify({
    client_email: 'bot@p.iam.gserviceaccount.com',
    private_key: privateKey,
  });

  it('exchanges a signed JWT for a token, then appends one row', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('oauth2'))
        return new Response(JSON.stringify({ access_token: 'ya29' }), { status: 200 });
      return new Response(
        JSON.stringify({ updates: { updatedRange: 'Incidents!A2:C2', updatedRows: 1 } }),
        { status: 200 }
      );
    });
    const res = await new CatalogExecutor(byType('google.sheets'), fetchMock as never).execute(
      {
        serviceAccount: sa,
        spreadsheetId: 'sheet1',
        range: 'Incidents!A:C',
        values: '["api", "down", 3]',
      },
      ctx()
    );
    expect(res.output).toEqual({ updatedRange: 'Incidents!A2:C2', updatedRows: 1 });

    const assertion = new URLSearchParams(calls[0].init.body as string).get('assertion')!;
    expect(jwt.verify(assertion, publicKey, { algorithms: ['RS256'] })).toMatchObject({
      iss: 'bot@p.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
    });
    expect(calls[1].url).toContain('/spreadsheets/sheet1/values/Incidents!A%3AC:append');
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ values: [['api', 'down', 3]] });
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer ya29');
  });
});
