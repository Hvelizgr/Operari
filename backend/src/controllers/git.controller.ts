import { Response, NextFunction } from 'express';
import { gitService } from '../services/git.service';
import { CustomError, ErrorCode } from '../errors/custom-error';
import { AuthRequest } from '../middleware/auth.middleware';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_REPO_BASE = path.join(os.homedir(), '.nanoflow', 'git-exports');

export class GitController {
    private getRepoPath(userId: string, customPath?: string): string {
        if (customPath) {
            return customPath;
        }
        return path.join(DEFAULT_REPO_BASE, userId);
    }

    async initRepo(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { repoPath } = req.body;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.initRepository(targetPath);
            res.json({ ...result, repoPath: targetPath });
        } catch (error) {
            next(error);
        }
    }

    async configureRemote(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { remoteUrl, remoteName, repoPath } = req.body;

            if (!remoteUrl) {
                throw new CustomError({ message: 'Remote URL is required', code: ErrorCode.VALIDATION_ERROR });
            }

            const targetPath = this.getRepoPath(userId, repoPath);
            const result = await gitService.configureRemote(targetPath, remoteUrl, remoteName);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async exportWorkflows(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { commitMessage, workflowIds, repoPath } = req.body;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.exportWorkflowsToGit(
                userId,
                targetPath,
                commitMessage,
                workflowIds
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async importWorkflows(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            const tenantId = req.user?.tenantId;
            if (!userId || !tenantId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { repoPath } = req.body;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.importWorkflowsFromGit(targetPath, userId, tenantId);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async push(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { remoteName, branch, repoPath, sshKey } = req.body;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.push(targetPath, remoteName, branch, sshKey);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async pull(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { remoteName, branch, repoPath, sshKey } = req.body;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.pull(targetPath, remoteName, branch, sshKey);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async getStatus(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const repoPath = req.query.repoPath as string | undefined;
            const targetPath = this.getRepoPath(userId, repoPath);

            const status = await gitService.getStatus(targetPath);
            res.json({ ...status, repoPath: targetPath });
        } catch (error) {
            next(error);
        }
    }

    async getLog(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const repoPath = req.query.repoPath as string | undefined;
            const maxCount = parseInt(req.query.maxCount as string) || 20;
            const targetPath = this.getRepoPath(userId, repoPath);

            const log = await gitService.getLog(targetPath, maxCount);
            res.json({ commits: log });
        } catch (error) {
            next(error);
        }
    }

    async getBranches(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const repoPath = req.query.repoPath as string | undefined;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.getBranches(targetPath);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async checkout(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const { branch, create, repoPath } = req.body;
            const targetPath = this.getRepoPath(userId, repoPath);

            const result = await gitService.checkout(targetPath, branch, create);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async getDiff(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new CustomError({ message: 'User not authenticated', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const workflowId = req.params.workflowId as string;
            const repoPath = req.query.repoPath as string | undefined;
            const targetPath = this.getRepoPath(userId, repoPath);

            const diff = await gitService.getDiff(targetPath, workflowId);
            res.json({ diff });
        } catch (error) {
            next(error);
        }
    }

    async getConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                throw new CustomError({ message: 'Tenant not identified', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const config = await gitService.getIntegrationConfig(tenantId);
            res.json(config || {});
        } catch (error) {
            next(error);
        }
    }

    async saveConfig(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) {
                throw new CustomError({ message: 'Tenant not identified', code: ErrorCode.CONFIGURATION_ERROR });
            }

            const config = await gitService.saveIntegrationConfig(tenantId, req.body);
            res.json(config);
        } catch (error) {
            next(error);
        }
    }
}

export const gitController = new GitController();
