import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/** What a step outputs or receives instead of the bytes. */
export interface FileRef {
  kind: 'file';
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
}

export function isFileRef(value: unknown): value is FileRef {
  const v = value as Partial<FileRef> | null;
  return (
    !!v &&
    typeof v === 'object' &&
    v.kind === 'file' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string'
  );
}

export class FileStoreError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'FileStoreError';
  }
}

const ID = /^[0-9a-f-]{36}$/;
const DAY = 24 * 60 * 60_000;

/**
 * Files passed between steps. Rows are tenant-scoped and every read checks
 * the tenant, so a reference copied into another workspace's runbook
 * resolves to nothing. Files expire (default 7 days); `sweep` deletes them.
 */
export class FileStore {
  readonly maxBytes: number;
  private readonly dir: string;
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    options: { dir?: string; maxBytes?: number; ttlMs?: number; now?: () => number } = {}
  ) {
    this.dir = options.dir ?? process.env.OPERARI_FILES_DIR ?? join(tmpdir(), 'operari-files');
    this.maxBytes =
      options.maxBytes ?? Number(process.env.OPERARI_FILE_MAX_BYTES ?? 50 * 1024 * 1024);
    this.ttlMs = options.ttlMs ?? 7 * DAY;
    this.now = options.now ?? Date.now;
  }

  private readonly now: () => number;

  private path(tenantId: string, id: string): string {
    return join(this.dir, tenantId.replace(/[^A-Za-z0-9_-]/g, '_'), id);
  }

  async save(input: {
    tenantId: string;
    executionId?: string;
    name: string;
    mimeType: string;
    data: Buffer;
  }): Promise<FileRef> {
    if (input.data.length > this.maxBytes) {
      throw new FileStoreError(
        `file is ${input.data.length} bytes, over the ${this.maxBytes} limit`,
        413
      );
    }
    const id = randomUUID();
    const sha256 = createHash('sha256').update(input.data).digest('hex');
    const name = (input.name || 'file').replace(/[\r\n/\\]/g, '_').slice(0, 200);
    const mimeType = /^[\w.+-]+\/[\w.+-]+(;.*)?$/.test(input.mimeType)
      ? input.mimeType.split(';')[0]
      : 'application/octet-stream';
    const path = this.path(input.tenantId, id);
    mkdirSync(join(path, '..'), { recursive: true, mode: 0o700 });
    await writeFile(path, input.data, { mode: 0o600 });
    await this.prisma.stepFile.create({
      data: {
        id,
        tenantId: input.tenantId,
        executionId: input.executionId ?? null,
        name,
        mimeType,
        size: input.data.length,
        sha256,
        expiresAt: new Date(this.now() + this.ttlMs),
      },
    });
    return { kind: 'file', id, name, mimeType, size: input.data.length, sha256 };
  }

  async read(tenantId: string, id: string): Promise<{ ref: FileRef; data: Buffer }> {
    if (!ID.test(id)) throw new FileStoreError('file not found', 404);
    const row = await this.prisma.stepFile.findFirst({ where: { id, tenantId } });
    if (!row || row.expiresAt.getTime() < this.now())
      throw new FileStoreError('file not found or expired', 404);
    const data = await readFile(this.path(tenantId, id));
    if (createHash('sha256').update(data).digest('hex') !== row.sha256) {
      throw new FileStoreError('file content does not match its checksum', 500);
    }
    return {
      ref: {
        kind: 'file',
        id,
        name: row.name,
        mimeType: row.mimeType,
        size: row.size,
        sha256: row.sha256,
      },
      data,
    };
  }

  /** Deletes expired files; returns how many. */
  async sweep(): Promise<number> {
    const expired = await this.prisma.stepFile.findMany({
      where: { expiresAt: { lt: new Date(this.now()) } },
      select: { id: true, tenantId: true },
      take: 1000,
    });
    for (const f of expired) {
      await rm(this.path(f.tenantId, f.id), { force: true });
    }
    if (expired.length) {
      await this.prisma.stepFile.deleteMany({ where: { id: { in: expired.map(f => f.id) } } });
    }
    return expired.length;
  }
}
