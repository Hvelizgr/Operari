import https from 'node:https';

import { blockedTarget } from '../../security/ssrf-guard';
import {
  apiNode,
  basic,
  baseUrl,
  type CatalogNode,
  enc,
  fail,
  MAIN,
  ok,
  type StepTools,
} from './define';

const meta = (
  type: string,
  icon: string,
  label: [string, string],
  description: [string, string]
) => ({
  type,
  category: 'infra',
  icon,
  color: 'bg-slate-700',
  label: { en: label[0], es: label[1] },
  description: { en: description[0], es: description[1] },
  inputs: MAIN,
  outputs: MAIN,
});

const githubHeaders = (t: StepTools) => ({
  Authorization: `Bearer ${t.str('token')}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'operari',
});

function repoPath(t: StepTools): string | null {
  const owner = t.str('owner');
  const repo = t.str('repo');
  return /^[\w.-]+$/.test(owner) && /^[\w.-]+$/.test(repo) ? `${owner}/${repo}` : null;
}

/** "KEY=value" lines or a JSON object → object. */
function keyValues(t: StepTools, name: string): Record<string, string> {
  const raw = t.value(name);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  }
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return {};
  if (text.startsWith('{')) return t.json<Record<string, string>>(name, {});
  return Object.fromEntries(
    text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        const i = l.indexOf('=');
        if (i < 1) throw new Error(`"${l}" must look like KEY=value`);
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

const kv = (name: string, displayName: string) => ({
  name,
  displayName,
  type: 'string' as const,
  description: 'One KEY=value per line, or a JSON object.',
  typeOptions: { rows: 3, expression: true },
});

interface KubeResponse {
  status: number;
  body: unknown;
}

function kubeRequest(
  server: string,
  token: string,
  ca: string | undefined,
  method: string,
  path: string,
  body: unknown,
  contentType: string,
  timeoutMs: number
): Promise<KubeResponse> {
  const url = new URL(path, server);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': contentType } : {}),
        },
        ...(ca ? { ca } : {}),
        timeout: timeoutMs,
      },
      res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed: unknown = data;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            // keep text
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error(`timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

export const DEVOPS_NODES: CatalogNode[] = [
  apiNode({
    ...meta(
      'github.actions',
      'Workflow',
      ['GitHub Actions', 'GitHub Actions'],
      [
        'Start a workflow (workflow_dispatch) or publish a release',
        'Lanzar un workflow (workflow_dispatch) o publicar un release',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'dispatch',
        options: [
          { name: 'Run workflow', value: 'dispatch' },
          { name: 'Create release', value: 'release' },
        ],
      },
      { name: 'token', displayName: 'Token', type: 'secret', required: true },
      { name: 'owner', displayName: 'Owner', type: 'string', required: true },
      { name: 'repo', displayName: 'Repository', type: 'string', required: true },
      {
        name: 'workflow',
        displayName: 'Workflow file or id',
        type: 'string',
        required: true,
        description: 'e.g. deploy.yml',
        displayOptions: { show: { action: ['dispatch'] } },
      },
      {
        name: 'ref',
        displayName: 'Branch or tag',
        type: 'string',
        default: 'main',
        typeOptions: { expression: true },
      },
      { ...kv('inputs', 'Workflow inputs'), displayOptions: { show: { action: ['dispatch'] } } },
      {
        name: 'tag',
        displayName: 'Tag',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['release'] } },
      },
      {
        name: 'notes',
        displayName: 'Release notes',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
        displayOptions: { show: { action: ['release'] } },
      },
      {
        name: 'prerelease',
        displayName: 'Pre-release',
        type: 'boolean',
        default: false,
        displayOptions: { show: { action: ['release'] } },
      },
    ],
    request: t => {
      const repo = repoPath(t);
      if (!repo) return 'owner and repo are required';
      if (t.str('action') === 'release') {
        return {
          method: 'POST',
          url: `https://api.github.com/repos/${repo}/releases`,
          headers: githubHeaders(t),
          body: {
            tag_name: t.str('tag'),
            name: t.str('tag'),
            target_commitish: t.str('ref') || undefined,
            body: t.str('notes'),
            prerelease: t.bool('prerelease'),
          },
          describe: `GitHub release ${repo}@${t.str('tag')}`,
        };
      }
      return {
        method: 'POST',
        url: `https://api.github.com/repos/${repo}/actions/workflows/${enc(t.str('workflow'))}/dispatches`,
        headers: githubHeaders(t),
        body: { ref: t.str('ref') || 'main', inputs: keyValues(t, 'inputs') },
        describe: `GitHub Actions ${repo} ${t.str('workflow')} on ${t.str('ref') || 'main'}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: number; html_url?: string };
      return { status, started: status === 204 || undefined, releaseId: b.id, url: b.html_url };
    },
  }),
  apiNode({
    ...meta(
      'gitlab.action',
      'Gitlab',
      ['GitLab', 'GitLab'],
      [
        'Trigger a pipeline or open an issue on GitLab (cloud or self-managed)',
        'Lanzar un pipeline o abrir un issue en GitLab (cloud o propio)',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'pipeline',
        options: [
          { name: 'Run pipeline', value: 'pipeline' },
          { name: 'Create issue', value: 'issue' },
        ],
      },
      { name: 'baseUrl', displayName: 'GitLab URL', type: 'string', default: 'https://gitlab.com' },
      { name: 'token', displayName: 'Access token', type: 'secret', required: true },
      {
        name: 'project',
        displayName: 'Project id or path',
        type: 'string',
        required: true,
        description: 'e.g. 123 or group/app',
      },
      {
        name: 'ref',
        displayName: 'Branch or tag',
        type: 'string',
        default: 'main',
        displayOptions: { show: { action: ['pipeline'] } },
      },
      {
        ...kv('variables', 'Pipeline variables'),
        displayOptions: { show: { action: ['pipeline'] } },
      },
      {
        name: 'title',
        displayName: 'Title',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['issue'] } },
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
        displayOptions: { show: { action: ['issue'] } },
      },
      {
        name: 'labels',
        displayName: 'Labels',
        type: 'string',
        description: 'Comma-separated.',
        displayOptions: { show: { action: ['issue'] } },
      },
    ],
    request: t => {
      const root = `${baseUrl(t.str('baseUrl'))}/api/v4/projects/${enc(t.str('project'))}`;
      const headers = { 'PRIVATE-TOKEN': t.str('token') };
      if (t.str('action') === 'issue') {
        return {
          method: 'POST',
          url: `${root}/issues`,
          headers,
          body: {
            title: t.str('title'),
            description: t.str('description'),
            labels: t.str('labels'),
          },
          describe: `GitLab issue in ${t.str('project')} — ${t.str('title').slice(0, 80)}`,
        };
      }
      return {
        method: 'POST',
        url: `${root}/pipeline`,
        headers,
        body: {
          ref: t.str('ref') || 'main',
          variables: Object.entries(keyValues(t, 'variables')).map(([key, value]) => ({
            key,
            value,
          })),
        },
        describe: `GitLab pipeline ${t.str('project')}@${t.str('ref') || 'main'}`,
      };
    },
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: number; iid?: number; web_url?: string; status?: string };
      return { status, id: b.id, iid: b.iid, url: b.web_url, pipelineStatus: b.status };
    },
  }),
  apiNode({
    ...meta(
      'jenkins.build',
      'Hammer',
      ['Jenkins build', 'Build en Jenkins'],
      [
        'Queue a Jenkins job, with or without parameters',
        'Encolar un job de Jenkins, con o sin parámetros',
      ]
    ),
    properties: [
      { name: 'baseUrl', displayName: 'Jenkins URL', type: 'string', required: true },
      {
        name: 'job',
        displayName: 'Job path',
        type: 'string',
        required: true,
        description: 'e.g. deploy or folder/deploy',
      },
      { name: 'username', displayName: 'User', type: 'string', required: true },
      { name: 'apiToken', displayName: 'API token', type: 'secret', required: true },
      kv('parameters', 'Parameters'),
    ],
    request: t => {
      const jobPath = t
        .str('job')
        .split('/')
        .filter(Boolean)
        .map(p => `job/${enc(p)}`)
        .join('/');
      const params = keyValues(t, 'parameters');
      const hasParams = Object.keys(params).length > 0;
      return {
        method: 'POST',
        url: `${baseUrl(t.str('baseUrl'))}/${jobPath}/${hasParams ? 'buildWithParameters' : 'build'}`,
        headers: { Authorization: basic(t.str('username'), t.str('apiToken')) },
        ...(hasParams ? { form: params } : {}),
        describe: `Jenkins build ${t.str('job')}`,
      };
    },
    shape: (_body, status) => ({ status, queued: status === 201 }),
  }),
  apiNode({
    ...meta(
      'circleci.pipeline',
      'CircleDashed',
      ['CircleCI pipeline', 'Pipeline de CircleCI'],
      ['Trigger a CircleCI pipeline on a branch', 'Lanzar un pipeline de CircleCI en una rama']
    ),
    properties: [
      { name: 'token', displayName: 'API token', type: 'secret', required: true },
      {
        name: 'projectSlug',
        displayName: 'Project slug',
        type: 'string',
        required: true,
        description: 'e.g. gh/acme/api',
      },
      { name: 'branch', displayName: 'Branch', type: 'string', default: 'main' },
      {
        name: 'parameters',
        displayName: 'Pipeline parameters (JSON)',
        type: 'string',
        typeOptions: { rows: 3, expression: true },
      },
    ],
    request: t => ({
      method: 'POST',
      url: `https://circleci.com/api/v2/project/${t.str('projectSlug').split('/').map(enc).join('/')}/pipeline`,
      headers: { 'Circle-Token': t.str('token') },
      body: { branch: t.str('branch') || 'main', parameters: t.json('parameters', {}) },
      describe: `CircleCI pipeline ${t.str('projectSlug')}@${t.str('branch') || 'main'}`,
    }),
    shape: (body, status) => {
      const b = (body ?? {}) as { id?: string; number?: number; state?: string };
      return { status, pipelineId: b.id, number: b.number, state: b.state };
    },
  }),
  apiNode({
    ...meta(
      'argocd.sync',
      'RefreshCcw',
      ['Argo CD sync', 'Sync de Argo CD'],
      [
        'Sync an Argo CD application, optionally to a revision',
        'Sincronizar una aplicación de Argo CD, opcionalmente a una revisión',
      ]
    ),
    properties: [
      { name: 'baseUrl', displayName: 'Argo CD URL', type: 'string', required: true },
      { name: 'token', displayName: 'Auth token', type: 'secret', required: true },
      {
        name: 'app',
        displayName: 'Application',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
      },
      {
        name: 'revision',
        displayName: 'Revision',
        type: 'string',
        description: 'Empty = the tracked revision.',
        typeOptions: { expression: true },
      },
      { name: 'prune', displayName: 'Prune', type: 'boolean', default: false },
      { name: 'dryRun', displayName: 'Argo dry run', type: 'boolean', default: false },
    ],
    request: t => ({
      method: 'POST',
      url: `${baseUrl(t.str('baseUrl'))}/api/v1/applications/${enc(t.str('app'))}/sync`,
      headers: { Authorization: `Bearer ${t.str('token')}` },
      body: {
        ...(t.str('revision') ? { revision: t.str('revision') } : {}),
        prune: t.bool('prune'),
        dryRun: t.bool('dryRun'),
      },
      describe: `Argo CD sync ${t.str('app')}`,
    }),
    shape: (body, status) => {
      const b = (body ?? {}) as {
        status?: { sync?: { status?: string }; health?: { status?: string } };
      };
      return { status, syncStatus: b.status?.sync?.status, health: b.status?.health?.status };
    },
  }),
  {
    ...meta(
      'kubernetes.action',
      'Container',
      ['Kubernetes', 'Kubernetes'],
      [
        'List pods, scale or restart a deployment through the API server',
        'Listar pods, escalar o reiniciar un deployment vía el API server',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'pods',
        options: [
          { name: 'List pods', value: 'pods' },
          { name: 'Get deployment', value: 'getDeployment' },
          { name: 'Scale deployment', value: 'scale' },
          { name: 'Rollout restart', value: 'restart' },
        ],
      },
      {
        name: 'server',
        displayName: 'API server URL',
        type: 'string',
        required: true,
        description: 'e.g. https://k8s.example.com:6443',
      },
      { name: 'token', displayName: 'Service account token', type: 'secret', required: true },
      {
        name: 'ca',
        displayName: 'Cluster CA (PEM)',
        type: 'secret',
        description: 'Needed when the API server uses a private CA.',
      },
      { name: 'namespace', displayName: 'Namespace', type: 'string', default: 'default' },
      {
        name: 'labelSelector',
        displayName: 'Label selector',
        type: 'string',
        description: 'e.g. app=api',
        displayOptions: { show: { action: ['pods'] } },
      },
      {
        name: 'deployment',
        displayName: 'Deployment',
        type: 'string',
        required: true,
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['getDeployment', 'scale', 'restart'] } },
      },
      {
        name: 'replicas',
        displayName: 'Replicas',
        type: 'number',
        required: true,
        displayOptions: { show: { action: ['scale'] } },
      },
      { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 15000 },
    ],
    run: async t => {
      let server: URL;
      try {
        server = new URL(t.str('server'));
      } catch {
        return fail('server must be a full https:// URL');
      }
      if (server.protocol !== 'https:') return fail('server must use https');
      const blocked = await blockedTarget('host', server.hostname);
      if (blocked) return fail(`kubernetes: ${blocked}`);

      const ns = enc(t.str('namespace') || 'default');
      const dep = enc(t.str('deployment'));
      const action = t.str('action');
      const call = (
        method: string,
        path: string,
        body?: unknown,
        contentType = 'application/json'
      ) => {
        t.context.emit?.({
          type: 'log',
          text: `kubernetes ${method} ${path}`,
          timestamp: new Date(),
        });
        return kubeRequest(
          server.toString(),
          t.str('token'),
          t.str('ca') || undefined,
          method,
          path,
          body,
          contentType,
          t.num('timeout')
        );
      };

      const writes = action === 'scale' || action === 'restart';
      if (writes && t.context.dryRun) {
        return ok({ dryRun: true, action, deployment: t.str('deployment') });
      }

      let res: KubeResponse;
      try {
        if (action === 'pods') {
          const q = t.str('labelSelector') ? `?labelSelector=${enc(t.str('labelSelector'))}` : '';
          res = await call('GET', `/api/v1/namespaces/${ns}/pods${q}`);
        } else if (action === 'getDeployment') {
          res = await call('GET', `/apis/apps/v1/namespaces/${ns}/deployments/${dep}`);
        } else if (action === 'scale') {
          res = await call(
            'PATCH',
            `/apis/apps/v1/namespaces/${ns}/deployments/${dep}/scale`,
            { spec: { replicas: Math.max(0, Math.floor(t.num('replicas'))) } },
            'application/merge-patch+json'
          );
        } else {
          res = await call(
            'PATCH',
            `/apis/apps/v1/namespaces/${ns}/deployments/${dep}`,
            {
              spec: {
                template: {
                  metadata: {
                    annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() },
                  },
                },
              },
            },
            'application/strategic-merge-patch+json'
          );
        }
      } catch (err) {
        return fail(`kubernetes: ${(err as Error).message}`);
      }
      if (res.status < 200 || res.status >= 300) {
        const message =
          (res.body as { message?: string })?.message ?? JSON.stringify(res.body).slice(0, 300);
        return fail(`kubernetes: HTTP ${res.status} — ${message}`);
      }

      if (action === 'pods') {
        const items = ((res.body as { items?: Array<Record<string, any>> })?.items ?? []).map(
          p => ({
            name: p.metadata?.name,
            phase: p.status?.phase,
            ready: (p.status?.containerStatuses ?? []).every((c: { ready?: boolean }) => c.ready),
            restarts: (p.status?.containerStatuses ?? []).reduce(
              (n: number, c: { restartCount?: number }) => n + (c.restartCount ?? 0),
              0
            ),
            node: p.spec?.nodeName,
            startedAt: p.status?.startTime,
          })
        );
        return ok({
          pods: items,
          count: items.length,
          notReady: items.filter(p => !p.ready).length,
        });
      }
      const d = res.body as {
        spec?: { replicas?: number };
        status?: { readyReplicas?: number; updatedReplicas?: number; availableReplicas?: number };
      };
      return ok({
        deployment: t.str('deployment'),
        replicas: d.spec?.replicas ?? null,
        readyReplicas: d.status?.readyReplicas ?? 0,
        updatedReplicas: d.status?.updatedReplicas ?? 0,
        availableReplicas: d.status?.availableReplicas ?? 0,
      });
    },
  },
  apiNode({
    ...meta(
      'cloudflare.action',
      'Cloud',
      ['Cloudflare', 'Cloudflare'],
      [
        'Purge the cache of a zone or point a DNS record somewhere else',
        'Purgar la caché de una zona o apuntar un registro DNS a otro lugar',
      ]
    ),
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'purge',
        options: [
          { name: 'Purge cache', value: 'purge' },
          { name: 'Update DNS record', value: 'dns' },
        ],
      },
      { name: 'token', displayName: 'API token', type: 'secret', required: true },
      { name: 'zoneId', displayName: 'Zone id', type: 'string', required: true },
      {
        name: 'files',
        displayName: 'URLs to purge',
        type: 'string',
        description: 'Comma-separated. Empty purges everything.',
        typeOptions: { rows: 2, expression: true },
        displayOptions: { show: { action: ['purge'] } },
      },
      {
        name: 'recordId',
        displayName: 'DNS record id',
        type: 'string',
        required: true,
        displayOptions: { show: { action: ['dns'] } },
      },
      {
        name: 'content',
        displayName: 'New content',
        type: 'string',
        required: true,
        description: 'e.g. the new IP for an A record.',
        typeOptions: { expression: true },
        displayOptions: { show: { action: ['dns'] } },
      },
    ],
    request: t => {
      const root = `https://api.cloudflare.com/client/v4/zones/${enc(t.str('zoneId'))}`;
      const headers = { Authorization: `Bearer ${t.str('token')}` };
      if (t.str('action') === 'dns') {
        return {
          method: 'PATCH',
          url: `${root}/dns_records/${enc(t.str('recordId'))}`,
          headers,
          body: { content: t.str('content') },
          describe: `Cloudflare DNS ${t.str('recordId')} → ${t.str('content')}`,
        };
      }
      const files = t.list('files').map(String);
      return {
        method: 'POST',
        url: `${root}/purge_cache`,
        headers,
        body: files.length ? { files } : { purge_everything: true },
        describe: files.length
          ? `Cloudflare purge ${files.length} URL(s)`
          : 'Cloudflare purge everything',
      };
    },
    bodyError: body => {
      const b = body as { success?: boolean; errors?: Array<{ message?: string }> };
      return b?.success === false
        ? b.errors?.map(e => e.message).join('; ') || 'Cloudflare returned success: false'
        : null;
    },
    shape: (body, status) => ({ status, result: (body as { result?: unknown })?.result }),
  }),
  apiNode({
    ...meta(
      'terraform.run',
      'Layers',
      ['Terraform Cloud run', 'Run de Terraform Cloud'],
      [
        'Queue a plan/apply run in an HCP Terraform (Terraform Cloud) workspace',
        'Encolar un run plan/apply en un workspace de HCP Terraform (Terraform Cloud)',
      ]
    ),
    properties: [
      { name: 'token', displayName: 'API token', type: 'secret', required: true },
      {
        name: 'workspaceId',
        displayName: 'Workspace id',
        type: 'string',
        required: true,
        description: 'ws-…',
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        default: 'Queued by Operari',
        typeOptions: { expression: true },
      },
      { name: 'autoApply', displayName: 'Apply automatically', type: 'boolean', default: false },
      {
        name: 'baseUrl',
        displayName: 'Host',
        type: 'string',
        default: 'https://app.terraform.io',
        description: 'Change for Terraform Enterprise.',
      },
    ],
    request: t => ({
      method: 'POST',
      url: `${baseUrl(t.str('baseUrl'))}/api/v2/runs`,
      headers: { Authorization: `Bearer ${t.str('token')}` },
      contentType: 'application/vnd.api+json',
      body: {
        data: {
          type: 'runs',
          attributes: { message: t.str('message'), 'auto-apply': t.bool('autoApply') },
          relationships: { workspace: { data: { type: 'workspaces', id: t.str('workspaceId') } } },
        },
      },
      describe: `Terraform run in ${t.str('workspaceId')}`,
    }),
    shape: (body, status) => {
      const d = ((body ?? {}) as { data?: { id?: string; attributes?: { status?: string } } }).data;
      return { status, runId: d?.id, runStatus: d?.attributes?.status };
    },
  }),
];
