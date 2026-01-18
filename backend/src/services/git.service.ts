import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import { prisma } from '../config/database';
import { CustomError, ErrorCode } from '../errors/custom-error';
import * as fs from 'fs';
import * as path from 'path';

export interface GitConfig {
    repoPath: string;
    remoteUrl?: string;
    branch?: string;
}

export interface ExportResult {
    success: boolean;
    commitHash?: string;
    message: string;
    filesExported: string[];
}

export class GitService {
    private getGitInstance(repoPath: string): SimpleGit {
        const options: Partial<SimpleGitOptions> = {
            baseDir: repoPath,
            binary: 'git',
            maxConcurrentProcesses: 6,
            trimmed: false,
        };
        return simpleGit(options);
    }

    async initRepository(repoPath: string): Promise<{ success: boolean; message: string }> {
        try {
            if (!fs.existsSync(repoPath)) {
                fs.mkdirSync(repoPath, { recursive: true });
            }

            const git = this.getGitInstance(repoPath);
            const isRepo = await git.checkIsRepo();

            if (!isRepo) {
                await git.init();
                return { success: true, message: `Git repository initialized at ${repoPath}` };
            }

            return { success: true, message: 'Repository already initialized' };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to initialize git repository',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async configureRemote(repoPath: string, remoteUrl: string, remoteName: string = 'origin'): Promise<{ success: boolean; message: string }> {
        try {
            const git = this.getGitInstance(repoPath);
            const remotes = await git.getRemotes(true);
            const existingRemote = remotes.find(r => r.name === remoteName);

            if (existingRemote) {
                await git.remote(['set-url', remoteName, remoteUrl]);
                return { success: true, message: `Remote '${remoteName}' updated to ${remoteUrl}` };
            } else {
                await git.addRemote(remoteName, remoteUrl);
                return { success: true, message: `Remote '${remoteName}' added: ${remoteUrl}` };
            }
        } catch (error) {
            throw new CustomError({
                message: 'Failed to configure git remote',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async exportWorkflowsToGit(
        userId: string,
        repoPath: string,
        commitMessage?: string,
        workflowIds?: string[]
    ): Promise<ExportResult> {
        try {
            const git = this.getGitInstance(repoPath);
            const isRepo = await git.checkIsRepo();

            if (!isRepo) {
                await this.initRepository(repoPath);
            }

            const workflowsDir = path.join(repoPath, 'workflows');
            if (!fs.existsSync(workflowsDir)) {
                fs.mkdirSync(workflowsDir, { recursive: true });
            }

            const whereClause: any = { userId };
            if (workflowIds && workflowIds.length > 0) {
                whereClause.id = { in: workflowIds };
            }

            const workflows = await prisma.workflow.findMany({
                where: whereClause,
                select: {
                    id: true,
                    name: true,
                    nodes: true,
                    connections: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });

            if (workflows.length === 0) {
                return {
                    success: false,
                    message: 'No workflows found to export',
                    filesExported: []
                };
            }

            const filesExported: string[] = [];

            for (const workflow of workflows) {
                const sanitizedName = workflow.name.replace(/[^a-zA-Z0-9-_]/g, '_');
                const filename = `${sanitizedName}_${workflow.id}.json`;
                const filepath = path.join(workflowsDir, filename);

                const workflowData = {
                    id: workflow.id,
                    name: workflow.name,
                    nodes: workflow.nodes,
                    connections: workflow.connections,
                    isActive: workflow.isActive,
                    exportedAt: new Date().toISOString(),
                    version: '1.0.0'
                };

                fs.writeFileSync(filepath, JSON.stringify(workflowData, null, 2));
                filesExported.push(filename);
            }

            await git.add('.');

            const status = await git.status();
            if (status.staged.length === 0 && status.modified.length === 0 && status.not_added.length === 0) {
                return {
                    success: true,
                    message: 'No changes to commit',
                    filesExported
                };
            }

            const message = commitMessage || `Export ${workflows.length} workflow(s) - ${new Date().toISOString()}`;
            const commit = await git.commit(message);

            return {
                success: true,
                commitHash: commit.commit,
                message: `Successfully exported ${workflows.length} workflow(s)`,
                filesExported
            };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to export workflows to git',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async push(repoPath: string, remoteName: string = 'origin', branch: string = 'main'): Promise<{ success: boolean; message: string }> {
        try {
            const git = this.getGitInstance(repoPath);

            const remotes = await git.getRemotes(true);
            if (remotes.length === 0) {
                return { success: false, message: 'No remote configured. Please configure a remote first.' };
            }

            await git.push(remoteName, branch, ['--set-upstream']);
            return { success: true, message: `Successfully pushed to ${remoteName}/${branch}` };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to push to remote',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async pull(repoPath: string, remoteName: string = 'origin', branch: string = 'main'): Promise<{ success: boolean; message: string; changes?: any }> {
        try {
            const git = this.getGitInstance(repoPath);
            const result = await git.pull(remoteName, branch);

            return {
                success: true,
                message: `Pulled ${result.summary.changes} change(s) from ${remoteName}/${branch}`,
                changes: result.summary
            };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to pull from remote',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async getStatus(repoPath: string): Promise<any> {
        try {
            const git = this.getGitInstance(repoPath);
            const isRepo = await git.checkIsRepo();

            if (!isRepo) {
                return { initialized: false, message: 'Not a git repository' };
            }

            const status = await git.status();
            const log = await git.log({ maxCount: 5 }).catch(() => ({ all: [] }));

            return {
                initialized: true,
                branch: status.current,
                ahead: status.ahead,
                behind: status.behind,
                staged: status.staged,
                modified: status.modified,
                notAdded: status.not_added,
                recentCommits: log.all.map(c => ({
                    hash: c.hash.substring(0, 7),
                    message: c.message,
                    date: c.date,
                    author: c.author_name
                }))
            };
        } catch (error) {
            throw new CustomError({
                message: 'Failed to get git status',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    async getLog(repoPath: string, maxCount: number = 20): Promise<any[]> {
        try {
            const git = this.getGitInstance(repoPath);
            const log = await git.log({ maxCount });

            return log.all.map(c => ({
                hash: c.hash,
                shortHash: c.hash.substring(0, 7),
                message: c.message,
                date: c.date,
                author: c.author_name,
                email: c.author_email
            }));
        } catch (error) {
            throw new CustomError({
                message: 'Failed to get git log',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }
}

export const gitService = new GitService();
