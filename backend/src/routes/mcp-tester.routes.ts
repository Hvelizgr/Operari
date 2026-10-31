import { NextFunction, Response, Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../audit/audit.service';
import { env } from '../config/env.config';
import {
  callTool,
  listTools,
  type McpTarget,
  McpTargetError,
  serverInfo,
  toolHash,
  withMcpClient,
} from '../integrations/mcp/mcp-client';
import { anonymousFallback, AuthRequest } from '../middleware/auth.middleware';
import { ConnectedAccountService } from '../security/connected-account.service';
import { SecretCipher } from '../security/secret-cipher';
import { SecretReader } from '../security/secret-reader';
import { prisma } from '../server';

const router = Router();

router.use(anonymousFallback);
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
});

const targetSchema = z.object({
  credentialId: z.string().max(64).optional(),
  url: z.string().max(2048).optional(),
  token: z.string().max(16_384).optional(),
});

const callSchema = targetSchema.extend({
  name: z.string().min(1).max(256),
  arguments: z.record(z.unknown()).default({}),
  timeoutMs: z.number().int().min(1000).max(120_000).optional(),
});

const audit = new AuditService(prisma);

let accounts: ConnectedAccountService | null = null;
function accountService(): ConnectedAccountService | null {
  if (accounts) return accounts;
  if (!env.ENCRYPTION_KEY) return null;
  const cipher = new SecretCipher(env.ENCRYPTION_KEY);
  accounts = new ConnectedAccountService(prisma, cipher, new SecretReader(cipher, audit), audit);
  return accounts;
}

class TargetError extends Error {}

/**
 * The server to talk to: a saved MCP credential (URL from its metadata,
 * token from the vault, read with a `secret.accessed` event) and/or a URL
 * and token typed into the tester, which are never stored.
 */
async function resolveTarget(
  req: AuthRequest,
  input: z.infer<typeof targetSchema>
): Promise<McpTarget> {
  const user = req.user!;
  let url = input.url?.trim() ?? '';
  let token = input.token?.trim() || undefined;
  if (input.credentialId) {
    const account = await prisma.connectedAccount.findFirst({
      where: { id: input.credentialId, tenantId: user.tenantId },
      select: { id: true, metadata: true },
    });
    const service = accountService();
    if (!account || !service) throw new TargetError('Credential not found in this workspace');
    const meta = (account.metadata ?? {}) as Record<string, unknown>;
    if (!url && typeof meta.url === 'string') url = meta.url;
    token = await service.getAccessToken({
      accountId: account.id,
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'user',
      reason: 'mcp-tester',
    });
  }
  if (!url) throw new TargetError('Enter the server URL or pick a credential that has one');
  return { url, token };
}

function sendError(res: Response, err: unknown) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'Invalid body', details: err.errors });
  }
  if (err instanceof TargetError || err instanceof McpTargetError) {
    return res.status(400).json({ error: err.message });
  }
  // The server answered badly or not at all; that is the result the
  // tester exists to show, so it is a 502 with the SDK's message.
  return res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
}

/**
 * POST /api/mcp-tester/inspect
 *
 * Connect and list what the server offers: identity, instructions,
 * capabilities, tools (each with the hash a step pins), resources and
 * prompts. Read-only, so it is not audited beyond the secret read.
 */
router.post('/inspect', async (req: AuthRequest, res: Response) => {
  const started = Date.now();
  try {
    const target = await resolveTarget(req, targetSchema.parse(req.body ?? {}));
    const data = await withMcpClient(target, async client => {
      const info = serverInfo(client);
      const caps = info.capabilities;
      const tools = caps.tools ? await listTools(client) : [];
      const resources = caps.resources
        ? (await client.listResources().catch(() => ({ resources: [] }))).resources
        : [];
      const prompts = caps.prompts
        ? (await client.listPrompts().catch(() => ({ prompts: [] }))).prompts
        : [];
      return {
        ...info,
        tools: tools.map(tool => ({ ...tool, hash: toolHash(tool) })),
        resources,
        prompts,
      };
    });
    return res.json({ data: { ...data, durationMs: Date.now() - started } });
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * POST /api/mcp-tester/call
 *
 * Call one tool and return the raw result. Tools can change things, so
 * every call is recorded in the audit chain (server host, tool, outcome
 * — not the arguments, which may carry data the caller typed in).
 */
router.post('/call', async (req: AuthRequest, res: Response) => {
  const started = Date.now();
  let host = '';
  let name = '';
  try {
    const body = callSchema.parse(req.body ?? {});
    name = body.name;
    const target = await resolveTarget(req, body);
    host = new URL(target.url).host;
    const timeoutMs = body.timeoutMs ?? 60_000;
    const result = await withMcpClient(
      target,
      client => callTool(client, body.name, body.arguments, timeoutMs),
      { timeoutMs }
    );
    const durationMs = Date.now() - started;
    await recordCall(req, host, name, result.isError ? 'tool_error' : 'ok', durationMs);
    return res.json({ data: { result, durationMs } });
  } catch (err) {
    if (host) await recordCall(req, host, name, 'failed', Date.now() - started);
    return sendError(res, err);
  }
});

async function recordCall(
  req: AuthRequest,
  host: string,
  tool: string,
  outcome: 'ok' | 'tool_error' | 'failed',
  durationMs: number
) {
  await audit
    .record({
      tenantId: req.user!.tenantId,
      type: 'mcp.tool_called',
      actorId: req.user!.id,
      actorType: 'user',
      resource: `mcp:${host}`,
      payload: { host, tool, outcome, durationMs, source: 'mcp-tester' },
    })
    .catch(err => req.log?.error({ err }, 'mcp.tool_called audit write failed'));
}

export default router;
