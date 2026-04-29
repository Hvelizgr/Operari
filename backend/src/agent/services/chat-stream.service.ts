import { MessageRole, PrismaClient } from '@prisma/client';
import type { ModelMessage } from 'ai';
import type { Response } from 'express';

import { logger } from '../../config/logger.config';
import { streamOrchestratorReply } from '../orchestrator';
import { ConversationService } from './conversation.service';

export class ChatStreamService {
  private prisma: PrismaClient;
  private conversationService: ConversationService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.conversationService = new ConversationService(prisma);
  }

  /**
   * Stream an AI response for a conversation.
   *
   * 1. Loads conversation history from DB
   * 2. Sends to Mastra orchestrator agent
   * 3. Streams response back via SSE (Vercel AI SDK data stream protocol)
   * 4. Persists the complete assistant message after streaming
   */
  async streamResponse(
    conversationId: string,
    userMessage: string,
    userId: string,
    tenantId: string,
    res: Response
  ) {
    // Save user message
    await this.conversationService.addMessage(conversationId, 'USER', userMessage);

    // Load conversation history
    const dbMessages = await this.conversationService.getMessages(conversationId);

    // Convert to Vercel AI SDK ModelMessage format
    const messages: ModelMessage[] = dbMessages.map(msg => ({
      role: this.toAIRole(msg.role),
      content: msg.content,
    })) as ModelMessage[];

    // Set SSE headers for Vercel AI SDK data stream protocol
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

    let fullResponse = '';

    try {
      const result = streamOrchestratorReply(messages, {
        tenantId,
        prisma: this.prisma,
      });

      // Iterate fullStream so the chat UI can render tool calls
      // (list_recent_runs, get_step_logs, ...) as visible bubbles
      // alongside the assistant text. Tag mapping mirrors the v1
      // Vercel AI SDK protocol the side-panel parser already speaks:
      //   0: text chunk    9: tool-call    a: tool-result
      // Other event types (text-start/end, finish-step, reasoning) are
      // intentionally dropped — protocol noise the chat UI doesn't
      // render, and persisting them would balloon Message.content
      // with no user benefit.
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullResponse += part.text;
          res.write(`0:${JSON.stringify(part.text)}\n`);
        } else if (part.type === 'tool-call') {
          res.write(
            `9:${JSON.stringify({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.input,
            })}\n`
          );
        } else if (part.type === 'tool-result') {
          res.write(
            `a:${JSON.stringify({
              toolCallId: part.toolCallId,
              result: part.output,
            })}\n`
          );
        } else if (part.type === 'tool-error') {
          res.write(
            `a:${JSON.stringify({
              toolCallId: part.toolCallId,
              result: { ok: false, error: String(part.error) },
            })}\n`
          );
        }
      }

      // Signal stream finish
      // Format: d:{"finishReason":"stop"}\n
      res.write(`d:${JSON.stringify({ finishReason: 'stop' })}\n`);
      res.end();

      // Persist complete assistant response — only the visible text
      // body, not the tool-call envelopes. Tool calls are runtime
      // ephemera; the assistant's narrative reply is what the user
      // sees on conversation reload.
      await this.conversationService.addMessage(conversationId, 'ASSISTANT', fullResponse, null, {
        model: process.env.AI_MODEL_NAME || 'claude-sonnet-4-6',
        provider: process.env.AI_MODEL_PROVIDER || 'anthropic',
      });

      logger.info({ conversationId, responseLength: fullResponse.length }, 'Chat stream completed');
    } catch (error) {
      logger.error({ error, conversationId }, 'Chat stream failed');

      // Send error in stream format
      const errorMsg = 'Sorry, something went wrong. Please try again.';
      res.write(`0:${JSON.stringify(errorMsg)}\n`);
      res.write(`d:${JSON.stringify({ finishReason: 'error' })}\n`);
      res.end();

      // Persist error message
      await this.conversationService.addMessage(conversationId, 'ASSISTANT', errorMsg, null, {
        error: true,
      });
    }
  }

  private toAIRole(role: MessageRole): 'user' | 'assistant' | 'system' {
    switch (role) {
      case 'USER':
        return 'user';
      case 'ASSISTANT':
        return 'assistant';
      case 'SYSTEM':
        return 'system';
      case 'TOOL':
        return 'assistant';
      default:
        return 'user';
    }
  }
}
