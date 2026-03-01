import { PrismaClient } from '@prisma/client';

export class CommentService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getComments(workflowId: string, nodeId: string) {
        return this.prisma.nodeComment.findMany({
            where: {
                workflowId,
                nodeId,
                parentId: null // Only get top-level comments
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                replies: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
    }

    async createComment(data: {
        workflowId: string;
        nodeId: string;
        userId: string;
        content: string;
        parentId?: string;
    }) {
        return this.prisma.nodeComment.create({
            data: {
                workflowId: data.workflowId,
                nodeId: data.nodeId,
                userId: data.userId,
                content: data.content,
                parentId: data.parentId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
    }

    async deleteComment(id: string, userId: string) {
        // Check if user is the owner
        const comment = await this.prisma.nodeComment.findUnique({
            where: { id }
        });

        if (!comment || comment.userId !== userId) {
            throw new Error('Unauthorized or comment not found');
        }

        return this.prisma.nodeComment.delete({
            where: { id }
        });
    }
}
