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

const CANDIDATE_DIRS = [
  path.resolve(__dirname, '../../../templates'),
  path.resolve(process.cwd(), '../templates'),
  path.resolve(process.cwd(), 'templates'),
  '/app/templates',
];

interface TemplateEntry {
  file: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  stepCount: number;
  yaml: string;
}

async function findTemplatesDir(): Promise<{ dir: string; files: string[] } | null> {
  for (const candidate of CANDIDATE_DIRS) {
    try {
      const list = await readdir(candidate);
      const files = list.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      if (files.length > 0) {
        return { dir: candidate, files };
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function parseTemplate(file: string, raw: string): TemplateEntry | null {
  try {
    const parsed = yaml.load(raw) as {
      slug?: string;
      name?: string;
      description?: string;
      category?: string;
      steps?: unknown[];
    } | null;
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
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const located = await findTemplatesDir();
    if (!located) {
      return res.json({ data: [] });
    }

    const templates = await Promise.all(
      located.files.map(async file => {
        try {
          const raw = await readFile(path.join(located.dir, file), 'utf-8');
          return parseTemplate(file, raw);
        } catch (err) {
          logger.warn({ err, file }, 'Failed to read template');
          return null;
        }
      })
    );

    res.json({ data: templates.filter((t): t is TemplateEntry => t !== null) });
  } catch (err) {
    logger.error({ err }, 'Failed to list templates');
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * GET /api/templates/:slug
 *
 * Single-template fetch for the public detail page at `/templates/:slug`.
 * Scans the same curated directory, parses only the candidates whose
 * slug (or filename-derived fallback) matches. 404 when the slug is
 * unknown so the frontend can render a proper "not found" state.
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    if (typeof slug !== 'string' || slug.length === 0) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const located = await findTemplatesDir();
    if (!located) {
      return res.status(404).json({ error: 'Template not found' });
    }

    for (const file of located.files) {
      const raw = await readFile(path.join(located.dir, file), 'utf-8').catch(() => null);
      if (!raw) continue;
      const tpl = parseTemplate(file, raw);
      if (tpl && tpl.slug === slug) {
        return res.json({ data: tpl });
      }
    }
    return res.status(404).json({ error: 'Template not found' });
  } catch (err) {
    logger.error({ err }, 'Failed to read template');
    return res.status(500).json({ error: 'Failed to read template' });
  }
});

export default router;

// Keep the helper exported for tests, even though it's not used at runtime.
export { resolveTemplatesDir };
