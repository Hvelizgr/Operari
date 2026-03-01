import { Request, Response } from 'express';
import { CommentService } from '../services/comment.service';
import { prisma } from '../server';

const commentService = new CommentService(prisma);

export class CommentController {
    static async getComments(req: Request, res: Response) {
        try {
            const workflowId = req.params.workflowId as string;
            const nodeId = req.params.nodeId as string;
            const comments = await commentService.getComments(workflowId, nodeId);
            res.json(comments);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async createComment(req: Request, res: Response) {
        try {
            const workflowId = req.params.workflowId as string;
            const nodeId = req.params.nodeId as string;
            const { content, parentId } = req.body;
            const userId = (req as any).user.id;

            const comment = await commentService.createComment({
                workflowId,
                nodeId,
                userId,
                content,
                parentId
            });

            res.status(201).json(comment);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteComment(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = (req as any).user.id;

            await commentService.deleteComment(id, userId);
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
