import { NewItemsExecutor } from '../../../runbook/executors/new-items.executor';

function fakePrisma() {
  const rows = new Map<string, unknown>();
  const tx = {
    $executeRaw: async () => 0,
    storageBucket: {
      findUnique: async ({ where }: any) => {
        const data = rows.get(where.tenantId_name.name);
        return data ? { data } : null;
      },
      upsert: async ({ where, create }: any) => rows.set(where.tenantId_name.name, create.data),
    },
  };
  return {
    rows,
    execution: { findUnique: async () => ({ runbookId: 'rb-1' }) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
}

const ctx = (list: unknown, dryRun = false) =>
  ({
    runId: 'r',
    stepId: 'new',
    tenantId: 't',
    variables: {},
    previousOutputs: { list },
    dryRun,
  }) as never;

describe('NewItemsExecutor', () => {
  it('emits everything on the first run when asked, keyed by a nested field', async () => {
    const prisma = fakePrisma();
    const exec = new NewItemsExecutor(prisma as never);
    const items = [{ meta: { id: 'a' } }, { meta: { id: 'b' } }, { meta: { id: 'a' } }];
    const res = await exec.execute(
      { items: '{{list}}', idField: 'meta.id', firstRun: 'emit' },
      ctx(items)
    );
    expect(res.output).toMatchObject({ count: 2, hasNew: true, firstRun: true });
    expect([...prisma.rows.keys()]).toEqual(['newItems:rb-1:new']);
  });

  it('forgets the oldest ids beyond the limit', async () => {
    const prisma = fakePrisma();
    const exec = new NewItemsExecutor(prisma as never);
    await exec.execute(
      { items: '{{list}}', idField: 'id', remember: 2 },
      ctx([{ id: 1 }, { id: 2 }, { id: 3 }])
    );
    expect((prisma.rows.get('newItems:rb-1:new') as { seen: string[] }).seen).toEqual(['2', '3']);
    const again = await exec.execute(
      { items: '{{list}}', idField: 'id', remember: 2 },
      ctx([{ id: 1 }])
    );
    expect(again.output).toMatchObject({ count: 1 });
  });

  it('refuses a non-list and writes nothing on a dry run', async () => {
    const prisma = fakePrisma();
    const exec = new NewItemsExecutor(prisma as never);
    expect((await exec.execute({ items: '{{list}}' }, ctx('nope'))).error).toMatch(
      /must resolve to a list/
    );
    const dry = await exec.execute({ items: '{{list}}' }, ctx([{ id: 1 }], true));
    expect(dry.output).toMatchObject({ dryRun: true, count: 0 });
    expect(prisma.rows.size).toBe(0);
  });
});
