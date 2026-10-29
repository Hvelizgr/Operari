import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Seeds a brand-new tenant with a single demo runbook so the operator
 * lands on /runbooks with something to look at and click into instead
 * of an empty list. The prior flow drops them on an empty-state page
 * that requires navigating to templates or the editor before anything
 * can run — an extra click where a concrete example would be more
 * useful.
 *
 * Shape: one note node ("what is this") next to one shell node ("echo
 * hello from Operari"). Intentionally simple: the demo exists to prove the
 * canvas + the run button work end-to-end, not to teach every node
 * type. A curious user will replace it within minutes.
 *
 * Fire-and-forget contract: callers MUST NOT await on the hot register
 * path. A seed failure leaves the tenant runnable, just without the
 * demo row — not worth failing registration over.
 */

const DEMO_RUNBOOK_NAME = 'Hello Operari';
const DEMO_RUNBOOK_DESCRIPTION =
  'Starter runbook — a tiny shell step that prints a greeting. Open the editor, hit ⌘+Enter to run it, and replace the nodes with something useful.';

/** Static slice of the runbook definition. Node IDs are deterministic
 *  so the same seed is byte-identical across tenants; this lets us
 *  round-trip it through YAML later without surprising diffs. */
const DEMO_NODES = [
  {
    id: 'demo-note',
    type: 'custom.note',
    title: 'Note',
    position: { x: 160, y: 80 },
    config: {
      text:
        'Welcome to Operari. This is your starter runbook — click “Run” in the top bar ' +
        'or press ⌘+Enter to trigger the shell step below. Replace it with your own ' +
        'diagnostic, failover, or deploy step when you are ready.',
    },
  },
  {
    id: 'demo-shell',
    type: 'shell',
    title: 'Print greeting',
    position: { x: 160, y: 340 },
    enabled: true,
    config: { command: 'echo "hello from Operari"' },
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
  },
];

const DEMO_CONNECTIONS: never[] = [];

export interface SeedDemoRunbookInput {
  tenantId: string;
  userId: string;
}

/** Runs the seed in the caller's process. Logs + swallows errors so
 *  a seed failure never blocks tenant creation. Returns the created
 *  runbook id on success (useful for tests), null on failure or when
 *  the tenant already has ≥1 runbook (idempotency). */
export async function seedDemoRunbook(
  prisma: PrismaClient,
  input: SeedDemoRunbookInput
): Promise<string | null> {
  try {
    // Idempotency: if the tenant already has any runbook, skip — a
    // retry of the register flow (OAuth double-bind, for example)
    // must never produce two demo rows.
    const existing = await prisma.runbook.count({
      where: { tenantId: input.tenantId },
    });
    if (existing > 0) return null;

    const runbook = await prisma.runbook.create({
      data: {
        name: DEMO_RUNBOOK_NAME,
        description: DEMO_RUNBOOK_DESCRIPTION,
        nodes: DEMO_NODES as unknown as Prisma.InputJsonValue,
        connections: DEMO_CONNECTIONS as unknown as Prisma.InputJsonValue,
        inputs: [] as unknown as Prisma.InputJsonValue,
        isActive: false,
        userId: input.userId,
        tenantId: input.tenantId,
      },
    });
    return runbook.id;
  } catch (err) {
    // Logged at warn — missing demo is cosmetic.

    console.warn('tenant-seed: demo runbook creation failed', {
      tenantId: input.tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
