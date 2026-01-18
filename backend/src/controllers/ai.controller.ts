import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';

export class AIController {
    static async generate(req: Request, res: Response) {
        try {
            const { prompt } = req.body;
            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const result = await AIService.generateWorkflow(prompt);
            res.json(result);
        } catch (error: any) {
            console.error('AI Controller Error:', error);
            res.status(500).json({ error: 'Failed to process AI request' });
        }
    }
}
