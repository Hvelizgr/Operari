import { Response, Router } from 'express';

import { anonymousFallback, AuthRequest } from '../middleware/auth.middleware';
import { GitHubBranchService } from '../runbook/services/github-branches.service';
import { prisma } from '../server';

const router = Router();

let service: GitHubBranchService | null = null;
function getService(): GitHubBranchService {
  if (!service) service = new GitHubBranchService(prisma);
  return service;
}

// Anonymous fallback gated by NANORUN_ANONYMOUS_MODE=true.
router.use(anonymousFallback);

/**
 * GET /api/github/:owner/:repo/branches
 *
 * Returns a list of branches for the given repo using the tenant's
 * GitHub connected account token.
 */
router.get('/:owner/:repo/branches', async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.params.owner as string;
    const repo = req.params.repo as string;
    const branches = await getService().listBranches(req.user!.tenantId, owner, repo);
    res.json({ data: branches });
  } catch (err) {
    req.log.error({ err }, 'GitHub branches error');
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

/**
 * GET /api/github/:owner/:repo/commits
 *
 * Returns recent commits. Optional ?sha=branch_name to scope
 * to a specific branch, and ?per_page=N (default 40, max 100).
 */
router.get('/:owner/:repo/commits', async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.params.owner as string;
    const repo = req.params.repo as string;
    const sha = req.query.sha as string | undefined;
    const perPage = Math.min(Number(req.query.per_page) || 40, 100);
    const commits = await getService().listCommits(req.user!.tenantId, owner, repo, {
      sha,
      perPage,
    });
    res.json({ data: commits });
  } catch (err) {
    req.log.error({ err }, 'GitHub commits error');
    res.status(500).json({ error: 'Failed to fetch commits' });
  }
});

/**
 * GET /api/github/:owner/:repo/graph
 *
 * Returns the full branch graph (branches + commits + default branch)
 * for the commit-graph visualization component.
 */
router.get('/:owner/:repo/graph', async (req: AuthRequest, res: Response) => {
  try {
    const owner = req.params.owner as string;
    const repo = req.params.repo as string;
    const graph = await getService().getGraph(req.user!.tenantId, owner, repo);
    if (!graph) {
      res.status(404).json({ error: 'No data found — check the repository name and GitHub token' });
      return;
    }
    res.json({ data: graph });
  } catch (err) {
    req.log.error({ err }, 'GitHub graph error');
    res.status(500).json({ error: 'Failed to fetch branch graph' });
  }
});

export default router;
