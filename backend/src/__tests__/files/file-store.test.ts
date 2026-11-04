import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { FileStore, isFileRef } from '../../files/file-store';
import { EmailExecutor } from '../../runbook/executors/email.executor';
import { HttpExecutor } from '../../runbook/executors/http.executor';

jest.mock('../../security/ssrf-guard', () => ({
  guardedFetch: (f: typeof fetch, url: string, init: RequestInit) => f(url, init),
}));

function fakePrisma() {
  const rows = new Map<string, any>();
  return {
    rows,
    stepFile: {
      create: async ({ data }: any) => rows.set(data.id, data),
      findFirst: async ({ where }: any) => {
        const r = rows.get(where.id);
        return r && r.tenantId === where.tenantId ? r : null;
      },
      findMany: async ({ where }: any) =>
        [...rows.values()].filter(r => r.expiresAt < where.expiresAt.lt),
      deleteMany: async ({ where }: any) => where.id.in.forEach((id: string) => rows.delete(id)),
    },
  };
}

let dir: string;
beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'files-test-'))));
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('FileStore', () => {
  it('stores bytes, reads them back only in the same workspace, and checks the hash', async () => {
    const prisma = fakePrisma();
    const store = new FileStore(prisma as any, { dir });
    const ref = await store.save({
      tenantId: 't1',
      name: 'a/b.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('%PDF'),
    });
    expect(isFileRef(ref)).toBe(true);
    expect(ref).toMatchObject({ name: 'a_b.pdf', mimeType: 'application/pdf', size: 4 });
    expect((await store.read('t1', ref.id)).data.toString()).toBe('%PDF');
    await expect(store.read('t2', ref.id)).rejects.toMatchObject({ status: 404 });
    await expect(store.read('t1', '../../etc/passwd')).rejects.toMatchObject({ status: 404 });
    writeFileSync(join(dir, 't1', ref.id), 'tampered');
    await expect(store.read('t1', ref.id)).rejects.toThrow(/checksum/);
  });

  it('refuses files over the limit and sweeps expired ones', async () => {
    let now = 1_000_000;
    const prisma = fakePrisma();
    const store = new FileStore(prisma as any, { dir, maxBytes: 3, ttlMs: 10, now: () => now });
    await expect(
      store.save({ tenantId: 't', name: 'x', mimeType: 'text/plain', data: Buffer.from('1234') })
    ).rejects.toMatchObject({ status: 413 });
    const ref = await store.save({
      tenantId: 't',
      name: 'x',
      mimeType: 'text/plain',
      data: Buffer.from('12'),
    });
    now += 11;
    await expect(store.read('t', ref.id)).rejects.toThrow(/expired/);
    expect(await store.sweep()).toBe(1);
    expect(readdirSync(join(dir, 't'))).toEqual([]);
    expect(prisma.rows.size).toBe(0);
  });
});

describe('HttpExecutor with files', () => {
  const ctx = (previousOutputs: Record<string, unknown> = {}) => ({
    runId: 'run-1',
    stepId: 's',
    tenantId: 't1',
    variables: {},
    previousOutputs,
  });

  it('saves a response as a file, then uploads it raw and as a multipart part', async () => {
    const store = new FileStore(fakePrisma() as any, { dir });
    const sent: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      if (init.method === 'GET') {
        return new Response(Buffer.from([0, 1, 2, 255]), {
          headers: {
            'content-type': 'image/png',
            'content-disposition': 'attachment; filename="logo.png"',
          },
        });
      }
      return new Response('{"ok":true}', { status: 200 });
    }) as unknown as typeof fetch;
    const http = new HttpExecutor(fetchImpl, { files: store });

    const down = await http.execute(
      { method: 'GET', url: 'https://cdn.example.com/x', responseFormat: 'file' },
      ctx() as any
    );
    const file = (down.output as any).file;
    expect(file).toMatchObject({ kind: 'file', name: 'logo.png', mimeType: 'image/png', size: 4 });
    expect((down.output as any).body).toBe('');

    const prev = { download: { output: { file } }, steps: { download: { output: { file } } } };
    const up = await http.execute(
      {
        method: 'PUT',
        url: 'https://up.example.com/f',
        bodyType: 'file',
        bodyFile: '{{steps.download.output.file}}',
      },
      ctx(prev) as any
    );
    expect(up.success).toBe(true);
    expect(Buffer.from(sent[1].init.body as Uint8Array)).toEqual(Buffer.from([0, 1, 2, 255]));
    expect((sent[1].init.headers as Record<string, string>)['Content-Type']).toBe('image/png');

    await http.execute(
      {
        method: 'POST',
        url: 'https://up.example.com/form',
        bodyType: 'multipart',
        multipart: { title: 'Logo', image: '{{steps.download.output.file}}' },
      },
      ctx(prev) as any
    );
    const form = sent[2].init.body as FormData;
    expect(form.get('title')).toBe('Logo');
    const part = form.get('image') as File;
    expect(part.name).toBe('logo.png');
    expect(Buffer.from(await part.arrayBuffer())).toEqual(Buffer.from([0, 1, 2, 255]));
  });

  it('fails clearly when the body file is not a file reference', async () => {
    const http = new HttpExecutor((async () => new Response('')) as any, {
      files: new FileStore(fakePrisma() as any, { dir }),
    });
    const res = await http.execute(
      { method: 'POST', url: 'https://x.example.com', bodyType: 'file', bodyFile: 'nope' },
      ctx() as any
    );
    expect(res.error).toMatch(/must reference a file/);
  });
});

describe('EmailExecutor attachments', () => {
  it('attaches files from earlier steps and refuses non-files', async () => {
    const store = new FileStore(fakePrisma() as any, { dir });
    const a = await store.save({
      tenantId: 't1',
      name: 'report.csv',
      mimeType: 'text/csv',
      data: Buffer.from('a,b'),
    });
    const b = await store.save({
      tenantId: 't1',
      name: 'logo.png',
      mimeType: 'image/png',
      data: Buffer.from([1]),
    });
    const sent: any[] = [];
    const email = new EmailExecutor(
      () =>
        ({
          sendMail: async (m: any) => (
            sent.push(m),
            { messageId: 'm', accepted: [], rejected: [] }
          ),
        }) as any,
      store
    );
    const ctx = {
      runId: 'r',
      stepId: 's',
      tenantId: 't1',
      variables: {},
      previousOutputs: { x: { output: { files: [a, b] } } },
    };
    const res = await email.execute(
      {
        to: 'ops@example.com',
        subject: 'Report',
        body: 'see attached',
        attachments: '{{x.output.files}}',
      },
      ctx as any
    );
    expect(res.success).toBe(true);
    expect(
      sent[0].attachments.map((f: any) => [f.filename, f.contentType, f.content.toString('hex')])
    ).toEqual([
      ['report.csv', 'text/csv', Buffer.from('a,b').toString('hex')],
      ['logo.png', 'image/png', '01'],
    ]);
    const bad = await email.execute(
      { to: 'a@b.co', subject: 's', body: '', attachments: 'not-a-file' },
      ctx as any
    );
    expect(bad.error).toMatch(/is not a file from an earlier step/);
    expect(sent).toHaveLength(1);
  });
});
