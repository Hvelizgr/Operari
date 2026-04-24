import { MessageRole, Prisma, PrismaClient } from '@prisma/client';

import { logger } from '../../config/logger.config';

export class ConversationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listConversations(userId: string, tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId, tenantId, status: { not: 'ARCHIVED' } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { agents: true } },
        },
      }),
      this.prisma.conversation.count({
        where: { userId, tenantId, status: { not: 'ARCHIVED' } },
      }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversation(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        agents: {
          include: {
            executions: {
              orderBy: { startedAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return conversation;
  }

  async createConversation(userId: string, tenantId: string, title?: string) {
    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        tenantId,
        title: title || null,
        status: 'ACTIVE',
      },
    });

    logger.info({ conversationId: conversation.id, userId }, 'Conversation created');
    return conversation;
  }

  async archiveConversation(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return null;
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    toolCalls?: unknown,
    metadata?: unknown
  ) {
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
        toolCalls: toolCalls ? (toolCalls as Prisma.InputJsonValue) : undefined,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    // Update conversation title from first user message if not set
    if (role === 'USER') {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation && !conversation.title) {
        const title = content.length > 60 ? content.substring(0, 60) + '...' : content;
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { title },
        });
      }
    }

    return message;
  }

  async getMessages(conversationId: string) {
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
