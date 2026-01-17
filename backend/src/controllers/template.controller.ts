import { Request, Response } from 'express';
import { WORKFLOW_TEMPLATES } from '../data/templates';

export class TemplateController {
    static getTemplates(req: Request, res: Response) {
        try {
            res.json(WORKFLOW_TEMPLATES);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            res.status(500).json({ error: 'Failed to fetch templates' });
        }
    }

    static getTemplateById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const template = WORKFLOW_TEMPLATES.find(t => t.id === id);

            if (!template) {
                res.status(404).json({ error: 'Template not found' });
                return;
            }

            res.json(template);
        } catch (error: any) {
            console.error('Error fetching template:', error);
            res.status(500).json({ error: 'Failed to fetch template' });
        }
    }
}
