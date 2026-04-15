import type { PrismaClient } from '@prisma/client';
import { WebhookService } from '../../../runbook/services/webhook.service';

function buildService(): WebhookService {
    return new WebhookService({} as PrismaClient);
}

describe('WebhookService.mapPayloadToVariables (github)', () => {
    let svc: WebhookService;

    beforeEach(() => {
        svc = buildService();
    });

    describe('push event', () => {
        const pushPayload = {
            ref: 'refs/heads/main',
            before: 'aaa',
            after: 'bbb',
            forced: false,
            created: false,
            deleted: false,
            pusher: { name: 'octocat', email: 'octo@github.com' },
            head_commit: {
                id: 'bbb',
                message: 'fix: update readme',
                url: 'https://github.com/acme/api/commit/bbb',
                author: { name: 'Octocat', email: 'octo@github.com' },
            },
            commits: [
                {
                    id: 'bbb',
                    message: 'fix: update readme',
                    author: { name: 'Octocat' },
                    url: 'https://github.com/acme/api/commit/bbb',
                    added: ['README.md'],
                    modified: [],
                    removed: [],
                },
            ],
            compare: 'https://github.com/acme/api/compare/aaa...bbb',
            repository: { full_name: 'acme/api' },
            sender: { login: 'octocat', avatar_url: 'https://avatar.url' },
        };

        it('extracts owner and repo from repository.full_name', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.owner).toBe('acme');
            expect(vars.repo).toBe('api');
            expect(vars.repository).toBe('acme/api');
        });

        it('extracts branch from ref', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.branch).toBe('main');
            expect(vars.ref).toBe('refs/heads/main');
        });

        it('extracts head_sha from head_commit', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.head_sha).toBe('bbb');
        });

        it('extracts commit details', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.commit_message).toBe('fix: update readme');
            expect(vars.commit_author).toBe('Octocat');
            expect(vars.commit_count).toBe(1);
            expect(vars.pusher).toBe('octocat');
        });

        it('extracts sender', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.sender).toBe('octocat');
            expect(vars.sender_avatar).toBe('https://avatar.url');
        });

        it('extracts compare URL', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.compare_url).toBe('https://github.com/acme/api/compare/aaa...bbb');
        });

        it('includes individual commit details', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            const commits = vars.commits as any[];
            expect(commits).toHaveLength(1);
            expect(commits[0].id).toBe('bbb');
            expect(commits[0].added).toEqual(['README.md']);
        });

        it('includes raw payload', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', pushPayload);
            expect(vars.raw).toBe(pushPayload);
        });
    });

    describe('pull_request event', () => {
        const prPayload = {
            action: 'opened',
            number: 42,
            pull_request: {
                title: 'Add new feature',
                body: 'Description of the PR',
                state: 'open',
                html_url: 'https://github.com/acme/api/pull/42',
                draft: false,
                merged: false,
                mergeable: true,
                additions: 10,
                deletions: 3,
                changed_files: 2,
                labels: [{ name: 'enhancement' }, { name: 'ready' }],
                head: {
                    sha: 'head-sha-123',
                    ref: 'feature/new',
                    label: 'acme:feature/new',
                },
                base: {
                    ref: 'main',
                    sha: 'base-sha-456',
                },
            },
            repository: { full_name: 'acme/api' },
            sender: { login: 'dev1', avatar_url: 'https://avatar.url' },
        };

        it('extracts PR metadata', () => {
            const vars = svc.mapPayloadToVariables('github', 'pull_request', prPayload);
            expect(vars.pr_number).toBe(42);
            expect(vars.pr_title).toBe('Add new feature');
            expect(vars.pr_state).toBe('open');
            expect(vars.pr_url).toBe('https://github.com/acme/api/pull/42');
            expect(vars.pr_draft).toBe(false);
        });

        it('extracts head and base refs', () => {
            const vars = svc.mapPayloadToVariables('github', 'pull_request', prPayload);
            expect(vars.head_sha).toBe('head-sha-123');
            expect(vars.head_ref).toBe('feature/new');
            expect(vars.base_ref).toBe('main');
            expect(vars.base_sha).toBe('base-sha-456');
        });

        it('extracts labels', () => {
            const vars = svc.mapPayloadToVariables('github', 'pull_request', prPayload);
            expect(vars.labels).toEqual(['enhancement', 'ready']);
        });

        it('extracts diff stats', () => {
            const vars = svc.mapPayloadToVariables('github', 'pull_request', prPayload);
            expect(vars.additions).toBe(10);
            expect(vars.deletions).toBe(3);
            expect(vars.changed_files).toBe(2);
        });

        it('extracts action', () => {
            const vars = svc.mapPayloadToVariables('github', 'pull_request', prPayload);
            expect(vars.action).toBe('opened');
        });
    });

    describe('issues event', () => {
        const issuePayload = {
            action: 'opened',
            issue: {
                number: 99,
                title: 'Bug report',
                body: 'Something is broken',
                state: 'open',
                html_url: 'https://github.com/acme/api/issues/99',
                labels: [{ name: 'bug' }],
            },
            repository: { full_name: 'acme/api' },
            sender: { login: 'reporter', avatar_url: 'https://avatar.url' },
        };

        it('extracts issue metadata', () => {
            const vars = svc.mapPayloadToVariables('github', 'issues', issuePayload);
            expect(vars.issue_number).toBe(99);
            expect(vars.issue_title).toBe('Bug report');
            expect(vars.issue_state).toBe('open');
            expect(vars.labels).toEqual(['bug']);
        });
    });

    describe('check_suite event', () => {
        it('extracts check suite fields', () => {
            const vars = svc.mapPayloadToVariables('github', 'check_suite', {
                action: 'completed',
                check_suite: {
                    head_sha: 'cs-sha-789',
                    head_branch: 'main',
                    conclusion: 'success',
                    status: 'completed',
                },
                repository: { full_name: 'acme/api' },
                sender: { login: 'github-actions[bot]' },
            });
            expect(vars.head_sha).toBe('cs-sha-789');
            expect(vars.head_branch).toBe('main');
            expect(vars.conclusion).toBe('success');
        });
    });

    describe('workflow_run event', () => {
        it('extracts workflow run fields', () => {
            const vars = svc.mapPayloadToVariables('github', 'workflow_run', {
                action: 'completed',
                workflow_run: {
                    name: 'CI',
                    head_sha: 'wr-sha-000',
                    head_branch: 'develop',
                    conclusion: 'failure',
                    status: 'completed',
                    html_url: 'https://github.com/acme/api/actions/runs/123',
                },
                repository: { full_name: 'acme/api' },
                sender: { login: 'github-actions[bot]' },
            });
            expect(vars.workflow_name).toBe('CI');
            expect(vars.head_sha).toBe('wr-sha-000');
            expect(vars.conclusion).toBe('failure');
            expect(vars.run_url).toBe('https://github.com/acme/api/actions/runs/123');
        });
    });

    describe('release event', () => {
        it('extracts release fields', () => {
            const vars = svc.mapPayloadToVariables('github', 'release', {
                action: 'published',
                release: {
                    tag_name: 'v1.2.0',
                    name: 'Release 1.2.0',
                    body: 'Changelog here',
                    prerelease: false,
                    draft: false,
                    html_url: 'https://github.com/acme/api/releases/tag/v1.2.0',
                    target_commitish: 'main',
                },
                repository: { full_name: 'acme/api' },
                sender: { login: 'releaser' },
            });
            expect(vars.tag_name).toBe('v1.2.0');
            expect(vars.release_name).toBe('Release 1.2.0');
            expect(vars.prerelease).toBe(false);
            expect(vars.head_sha).toBe('main');
        });
    });

    describe('deployment_status event', () => {
        it('extracts deployment status fields', () => {
            const vars = svc.mapPayloadToVariables('github', 'deployment_status', {
                action: 'created',
                deployment: {
                    sha: 'dep-sha-111',
                    environment: 'production',
                    description: 'Deploy to prod',
                },
                deployment_status: {
                    state: 'success',
                    target_url: 'https://app.example.com',
                },
                repository: { full_name: 'acme/api' },
                sender: { login: 'deployer' },
            });
            expect(vars.head_sha).toBe('dep-sha-111');
            expect(vars.environment).toBe('production');
            expect(vars.deployment_status).toBe('success');
        });
    });

    describe('unknown event', () => {
        it('returns minimal envelope with raw payload', () => {
            const payload = {
                action: 'some_action',
                repository: { full_name: 'acme/api' },
                sender: { login: 'bot' },
            };
            const vars = svc.mapPayloadToVariables('github', 'some_unknown_event', payload);
            expect(vars.source).toBe('github');
            expect(vars.owner).toBe('acme');
            expect(vars.repo).toBe('api');
            expect(vars.raw).toBe(payload);
        });
    });

    describe('edge cases', () => {
        it('handles missing repository gracefully', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', {
                ref: 'refs/heads/main',
            });
            expect(vars.owner).toBe('');
            expect(vars.repo).toBe('');
        });

        it('handles push without head_commit (branch delete)', () => {
            const vars = svc.mapPayloadToVariables('github', 'push', {
                ref: 'refs/heads/old-branch',
                after: '0000000000000000000000000000000000000000',
                deleted: true,
                repository: { full_name: 'acme/api' },
                sender: { login: 'dev' },
            });
            expect(vars.head_sha).toBe('0000000000000000000000000000000000000000');
            expect(vars.deleted).toBe(true);
        });
    });
});
