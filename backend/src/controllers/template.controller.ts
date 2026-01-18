import { Request, Response } from 'express';
import { prisma } from '../config/database';

export class TemplateController {
    static async getTemplates(req: Request, res: Response) {
        try {
            const { category, search, public: isPublic } = req.query;

            const templates = await (prisma as any).template.findMany({
                where: {
                    ...(category && { category: category as string }),
                    ...(isPublic === 'true' ? { isPublic: true } : {}),
                    ...(search && {
                        OR: [
                            { name: { path: ['en'], string_contains: search as string } },
                            { name: { path: ['es'], string_contains: search as string } },
                            { description: { path: ['en'], string_contains: search as string } },
                            { description: { path: ['es'], string_contains: search as string } },
                        ]
                    })
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json(templates);
        } catch (error: any) {
            console.error('Error fetching templates:', error);
            res.status(500).json({ error: 'Failed to fetch templates' });
        }
    }

    static async getTemplateById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const template = await (prisma as any).template.findUnique({
                where: { id }
            });

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

    static async publishTemplate(req: Request, res: Response) {
        try {
            const { name, description, nodes, connections, category, icon, tags, isPublic } = req.body;
            const userId = (req as any).user?.id;

            const template = await (prisma as any).template.create({
                data: {
                    name,
                    description,
                    nodes,
                    connections,
                    category,
                    icon,
                    tags,
                    isPublic: isPublic ?? true,
                    userId
                }
            });

            res.status(201).json(template);
        } catch (error: any) {
            console.error('Error publishing template:', error);
            res.status(500).json({ error: 'Failed to publish template' });
        }
    }
}

