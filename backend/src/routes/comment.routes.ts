import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/:workflowId/:nodeId', authenticate, CommentController.getComments);
router.post('/:workflowId/:nodeId', authenticate, CommentController.createComment);
router.delete('/:id', authenticate, CommentController.deleteComment);

export default router;
