import { Response, Router } from 'express';
import { z } from 'zod';

import { ConversationService } from '../agent/services/conversation.service';
import { logger } from '../config/logger.config';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

// Lazy-initialize services to avoid circular import issues with prisma
let _conversationService: ConversationService | null = null;
function getConversationService() {
  if (!_conversationService) {
    _conversationService = new ConversationService(prisma);
  }
  return _conversationService;
}

let _chatStreamService: any = null;
function getChatStreamService() {
  if (!_chatStreamService) {
    const { ChatStreamService } = require('../agent/services/chat-stream.service');
    _chatStreamService = new ChatStreamService(prisma);
  }
  return _chatStreamService;
}

// Ensure default tenant and anonymous user exist, then set on request
let defaultsInitialized = false;
let defaultTenantId = 'default-tenant';

async function ensureDefaults() {
  if (defaultsInitialized) return;
  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'default' },
      update: {},
      create: { id: 'default-tenant', name: 'Default', slug: 'default', plan: 'FREE' },
    });
    defaultTenantId = tenant.id;

    await prisma.user.upsert({
      where: { email: 'anonymous@nanorun.local' },
      update: {},
      create: {
        id: 'anonymous',
        email: 'anonymous@nanorun.local',
        passwordHash: '',
        name: 'Anonymous',
        role: 'USER',
        tenantId: tenant.id,
      },
    });
    defaultsInitialized = true;
  } catch {
    // DB might not be ready yet, will retry on next request
  }
}

router.use((req: AuthRequest, _res, next) => {
  if (!req.user) {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@nanorun.local',
      role: 'USER',
      tenantId: defaultTenantId,
    };
  }
  next();
});

// Validation schemas
const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: List conversations
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaults();
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getConversationService().listConversations(
      req.user!.id,
      req.user!.tenantId,
      page,
      limit
    );
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * @swagger
 * /chat/conversations:
 *   post:
 *     summary: Create a new conversation
 *     tags: [Chat]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Conversation created
 */
router.post('/conversations', async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaults();
    const { title } = createConversationSchema.parse(req.body);
    const conversation = await getConversationService().createConversation(
      req.user!.id,
      req.user!.tenantId,
      title
    );
    res.status(201).json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
    }
    logger.error({ error }, 'Failed to create conversation');
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * POST /api/chat/conversations/from-run
 *
 * Create a new conversation pre-seeded with a "Diagnose run <id>"
 * user message, so the dashboard's "Ask AI →" button can deep-link
 * the operator into a conversation that already has the right context
 * for the orchestrator to call get_run_details on.
 *
 * Body: { runId: string }
 * Response: { id: string }  ← the new conversation id
 */
router.post('/conversations/from-run', async (req: AuthRequest, res: Response) => {
  try {
    await ensureDefaults();
    const schema = z.object({ runId: z.string().min(1) });
    const { runId } = schema.parse(req.body);

    // Verify the run belongs to the tenant — never let the model see runs from elsewhere.
    const run = await prisma.execution.findFirst({
      where: { id: runId, workflow: { tenantId: req.user!.tenantId } },
      include: { workflow: { select: { name: true } } },
    });
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const title = `Diagnose: ${run.workflow.name}`;
    const conversation = await getConversationService().createConversation(
      req.user!.id,
      req.user!.tenantId,
      title
    );

    // Return the suggested prompt — the frontend deep-links into the
    // chat with ?id=<id>&prompt=<encoded> and submits it as the first
    // user message. This keeps the streaming path identical to a
    // normal chat send (no special "first message" code path) and
    // avoids charging tokens for conversations the user never opens.
    const prompt = `Diagnose run ${runId}. Use get_run_details to fetch the steps and tell me what failed and how to fix it.`;

    res.status(201).json({ id: conversation.id, prompt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid parameters', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create conversation from run' });
  }
});

/**
 * @swagger
 * /chat/conversations/{id}:
 *   get:
 *     summary: Get conversation with messages
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation details
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationService().getConversation(
      String(req.params.id),
      req.user!.id
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * @swagger
 * /chat/conversations/{id}:
 *   delete:
 *     summary: Archive a conversation
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation archived
 *       404:
 *         description: Conversation not found
 */
router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationService().archiveConversation(
      String(req.params.id),
      req.user!.id
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation archived', id: conversation.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   post:
 *     summary: Send a message to the conversation
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response (streaming in Sprint 2)
 *       404:
 *         description: Conversation not found
 */
router.post('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { content } = sendMessageSchema.parse(req.body);
    const conversationId = String(req.params.id);

    // Verify conversation exists and belongs to user
    const conversation = await getConversationService().getConversation(
      conversationId,
      req.user!.id
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check if AI is configured
    const hasAIKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;

    if (!hasAIKey) {
      // Fallback: non-streaming response when no AI key is configured
      const userMessage = await getConversationService().addMessage(
        conversationId,
        'USER',
        content
      );
      const assistantMessage = await getConversationService().addMessage(
        conversationId,
        'ASSISTANT',
        'AI is not configured yet. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to your .env file.'
      );
      return res.json({ userMessage, assistantMessage });
    }

    // Stream AI response
    await getChatStreamService().streamResponse(
      conversationId,
      content,
      req.user!.id,
      req.user!.tenantId,
      res
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid message', details: error.errors });
    }
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
});

export default router;
