import { Router, Response, Request } from 'express';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { logger } from '../config/logger.config';

/**
 * GET /api/templates
 *
 * Reads the curated YAML runbook templates from the repo's `templates/`
 * directory and returns parsed metadata for each one. The Runbooks page
 * uses this to render its "from template" picker.
 *
 * The body of the YAML file is returned alongside the metadata so the
 * frontend can post it directly to the runbook create flow without a
 * second round-trip per template.
 */
const router = Router();

// Resolve once. The container layout puts the backend at /app/backend
// and the templates at /app/templates. Locally we run from the repo
// root, so go up two levels from this file (dist/routes → backend → root).
function resolveTemplatesDir(): string {
    const candidates = [
        path.resolve(__dirname, '../../../templates'),
        path.resolve(process.cwd(), '../templates'),
        path.resolve(process.cwd(), 'templates'),
        '/app/templates',
    ];
    return candidates[0]; // first try; runtime fallback handled at read time
}

router.get('/', async (_req: Request, res: Response) => {
    try {
        const dirs = [
            path.resolve(__dirname, '../../../templates'),
            path.resolve(process.cwd(), '../templates'),
            path.resolve(process.cwd(), 'templates'),
            '/app/templates',
        ];

        let dir: string | null = null;
        let entries: string[] = [];
        for (const candidate of dirs) {
            try {
                const list = await readdir(candidate);
                entries = list.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
                if (entries.length > 0) {
                    dir = candidate;
                    break;
                }
            } catch {
                // try the next candidate
            }
        }

        if (!dir) {
            return res.json({ data: [] });
        }

        const templates = await Promise.all(
            entries.map(async (file) => {
                try {
                    const raw = await readFile(path.join(dir!, file), 'utf-8');
                    const parsed = yaml.load(raw) as any;
                    if (!parsed || typeof parsed !== 'object') return null;
                    return {
                        file,
                        slug: parsed.slug ?? file.replace(/\.ya?ml$/, ''),
                        name: parsed.name ?? file,
                        description: parsed.description ?? null,
                        category: parsed.category ?? null,
                        stepCount: Array.isArray(parsed.steps) ? parsed.steps.length : 0,
                        yaml: raw,
                    };
                } catch (err) {
                    logger.warn({ err, file }, 'Failed to parse template');
                    return null;
                }
            }),
        );

        res.json({ data: templates.filter((t) => t !== null) });
    } catch (err) {
        logger.error({ err }, 'Failed to list templates');
        res.status(500).json({ error: 'Failed to list templates' });
    }
});

export default router;

// Keep the helper exported for tests, even though it's not used at runtime.
export { resolveTemplatesDir };
