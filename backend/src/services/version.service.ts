import { logger } from '../config/logger.config';
import { Octokit } from '@octokit/rest';
import { prisma } from '../server';

export interface WorkflowVersionData {
    name?: string;
    description?: string;
    nodes: any;
    connections: any;
}

export class VersionService {
    private static instance: VersionService;

    private constructor() {}

    public static getInstance(): VersionService {
        if (!VersionService.instance) {
            VersionService.instance = new VersionService();
        }
        return VersionService.instance;
    }

    async createVersion(
        workflowId: string,
        userId: string,
        data: WorkflowVersionData,
        commitMessage?: string
    ) {
        const lastVersion = await prisma.workflowVersion.findFirst({
            where: { workflowId },
            orderBy: { version: 'desc' },
        });

        const newVersion = (lastVersion?.version || 0) + 1;

        const version = await prisma.workflowVersion.create({
            data: {
                workflowId,
                userId,
                version: newVersion,
                name: data.name || `Version ${newVersion}`,
                description: data.description || commitMessage,
                nodes: data.nodes,
                connections: data.connections,
            },
        });

        logger.info({ workflowId, version: newVersion }, 'Created workflow version');
        return version;
    }

    async getVersions(workflowId: string) {
        return prisma.workflowVersion.findMany({
            where: { workflowId },
            orderBy: { version: 'desc' },
        });
    }

    async getVersion(workflowId: string, version: number) {
        return prisma.workflowVersion.findUnique({
            where: {
                workflowId_version: { workflowId, version },
            },
        });
    }

    async restoreVersion(workflowId: string, version: number) {
        const versionData = await this.getVersion(workflowId, version);
        if (!versionData) {
            throw new Error('Version not found');
        }

        await prisma.workflow.update({
            where: { id: workflowId },
            data: {
                nodes: versionData.nodes as any,
                connections: versionData.connections as any,
            },
        });

        logger.info({ workflowId, version }, 'Restored workflow to version');
        return versionData;
    }

    async compareVersions(workflowId: string, versionA: number, versionB: number) {
        const [a, b] = await Promise.all([
            this.getVersion(workflowId, versionA),
            this.getVersion(workflowId, versionB),
        ]);

        if (!a || !b) {
            throw new Error('One or both versions not found');
        }

        const nodesA = a.nodes as any[] || [];
        const nodesB = b.nodes as any[] || [];
        const connectionsA = a.connections as any[] || [];
        const connectionsB = b.connections as any[] || [];

        const nodeIdsA = new Set(nodesA.map((n: any) => n.id));
        const nodeIdsB = new Set(nodesB.map((n: any) => n.id));

        const added = nodesB.filter((n: any) => !nodeIdsA.has(n.id));
        const removed = nodesA.filter((n: any) => !nodeIdsB.has(n.id));
        const modified = nodesB.filter((n: any) => {
            if (!nodeIdsA.has(n.id)) return false;
            const oldNode = nodesA.find((old: any) => old.id === n.id);
            return JSON.stringify(oldNode) !== JSON.stringify(n);
        });

        return {
            versionA: a,
            versionB: b,
            diff: {
                nodes: { added, removed, modified },
                connections: {
                    added: connectionsB.filter((c: any) => 
                        !connectionsA.some((old: any) => old.id === c.id)
                    ),
                    removed: connectionsA.filter((c: any) => 
                        !connectionsB.some((newC: any) => newC.id === c.id)
                    ),
                },
            },
        };
    }

    async getGitHubIntegration(tenantId: string) {
        return prisma.gitHubIntegration.findUnique({
            where: { tenantId },
        });
    }

    async setupGitHubIntegration(
        tenantId: string,
        accessToken: string,
        owner: string,
        repo: string,
        branch = 'main',
        path = 'workflows'
    ) {
        return prisma.gitHubIntegration.upsert({
            where: { tenantId },
            update: { accessToken, owner, repo, branch, path },
            create: { tenantId, accessToken, owner, repo, branch, path },
        });
    }

    async removeGitHubIntegration(tenantId: string) {
        await prisma.gitHubIntegration.delete({
            where: { tenantId },
        });
    }

    async pushToGitHub(
        tenantId: string,
        workflowId: string,
        userId: string,
        commitMessage: string
    ) {
        const integration = await this.getGitHubIntegration(tenantId);
        if (!integration) {
            throw new Error('GitHub integration not configured');
        }

        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
        });

        if (!workflow) {
            throw new Error('Workflow not found');
        }

        const octokit = new Octokit({ auth: integration.accessToken });
        const filePath = `${integration.path}/${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        const content = JSON.stringify({
            name: workflow.name,
            description: workflow.description,
            nodes: workflow.nodes,
            connections: workflow.connections,
        }, null, 2);

        let sha: string | undefined;
        try {
            const { data: existingFile } = await octokit.repos.getContent({
                owner: integration.owner,
                repo: integration.repo,
                path: filePath,
                ref: integration.branch,
            });
            if ('sha' in existingFile) {
                sha = existingFile.sha;
            }
        } catch (e: any) {
            if (e.status !== 404) throw e;
        }

        const { data: commit } = await octokit.repos.createOrUpdateFileContents({
            owner: integration.owner,
            repo: integration.repo,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            branch: integration.branch,
            sha,
        });

        const version = await this.createVersion(workflowId, userId, {
            name: commitMessage,
            nodes: workflow.nodes,
            connections: workflow.connections,
        }, commitMessage);

        await prisma.workflowVersion.update({
            where: { id: version.id },
            data: {
                commitSha: commit.commit?.sha,
                commitUrl: commit.commit?.html_url,
            },
        });

        logger.info({ workflowId, sha: commit.commit?.sha }, 'Pushed workflow to GitHub');

        return {
            version,
            commit: {
                sha: commit.commit?.sha,
                url: commit.commit?.html_url,
            },
        };
    }

    async pullFromGitHub(
        tenantId: string,
        workflowName: string
    ) {
        const integration = await this.getGitHubIntegration(tenantId);
        if (!integration) {
            throw new Error('GitHub integration not configured');
        }

        const octokit = new Octokit({ auth: integration.accessToken });
        const filePath = `${integration.path}/${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;

        const { data } = await octokit.repos.getContent({
            owner: integration.owner,
            repo: integration.repo,
            path: filePath,
            ref: integration.branch,
        });

        if (!('content' in data)) {
            throw new Error('Could not read file content');
        }

        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const workflowData = JSON.parse(content);

        logger.info({ workflowName }, 'Pulled workflow from GitHub');
        return workflowData;
    }

    async listGitHubWorkflows(tenantId: string) {
        const integration = await this.getGitHubIntegration(tenantId);
        if (!integration) {
            throw new Error('GitHub integration not configured');
        }

        const octokit = new Octokit({ auth: integration.accessToken });

        try {
            const { data } = await octokit.repos.getContent({
                owner: integration.owner,
                repo: integration.repo,
                path: integration.path,
                ref: integration.branch,
            });

            if (!Array.isArray(data)) {
                return [];
            }

            return data
                .filter((file: any) => file.name.endsWith('.json'))
                .map((file: any) => ({
                    name: file.name.replace('.json', '').replace(/-/g, ' '),
                    path: file.path,
                    sha: file.sha,
                    url: file.html_url,
                }));
        } catch (e: any) {
            if (e.status === 404) {
                return [];
            }
            throw e;
        }
    }

    async getCommitHistory(tenantId: string, workflowName: string) {
        const integration = await this.getGitHubIntegration(tenantId);
        if (!integration) {
            throw new Error('GitHub integration not configured');
        }

        const octokit = new Octokit({ auth: integration.accessToken });
        const filePath = `${integration.path}/${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;

        const { data: commits } = await octokit.repos.listCommits({
            owner: integration.owner,
            repo: integration.repo,
            path: filePath,
            sha: integration.branch,
            per_page: 50,
        });

        return commits.map((c: any) => ({
            sha: c.sha,
            message: c.commit.message,
            author: c.commit.author?.name,
            date: c.commit.author?.date,
            url: c.html_url,
        }));
    }
}

export const versionService = VersionService.getInstance();
