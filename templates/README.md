# NanoRun Templates

Production-ready runbook templates you can import into NanoRun and adapt to your stack.

## Available templates

| Template | Category | What it does |
|---|---|---|
| [`deploy-nextjs-vercel.yaml`](./deploy-nextjs-vercel.yaml) | deploy | Pull main → tests → build → approval → Vercel deploy → smoke test → Slack |
| [`db-migration-prisma.yaml`](./db-migration-prisma.yaml) | migration | Backup DB → check pending migrations → approval → apply → verify → notify |
| [`rotate-aws-secrets.yaml`](./rotate-aws-secrets.yaml) | security | Create new IAM key → propagate to Vercel/GitHub → verify → revoke old key |
| [`k8s-rolling-deploy.yaml`](./k8s-rolling-deploy.yaml) | deploy | Update image → watch rollout → smoke test pods → notify |
| [`onboard-new-developer.yaml`](./onboard-new-developer.yaml) | ops | GitHub invite → team membership → IAM user → welcome Slack message |

## How to use

1. Open NanoRun: `http://localhost:3000/en/editor`
2. Click "Import Template" (coming soon — for now, copy the YAML content into a new runbook manually)
3. Set the required variables
4. Hit Run

Or via the CLI:

```bash
nanorun run deploy-nextjs-vercel \
  -v vercel_token=$VERCEL_TOKEN \
  -v slack_webhook_url=$SLACK_WEBHOOK \
  -v production_url=https://myapp.com
```

## Template format

NanoRun templates are YAML files with three top-level keys:

```yaml
name: Human readable name
slug: kebab-case-id
description: What this runbook does
category: deploy | migration | security | ops | incident

steps:
  - id: unique_step_id
    type: shell | http | wait | approval | notify | ...
    title: What this step does
    config:
      # Type-specific config
      command: echo "{{vars.foo}}"

connections:
  - { source: step_a, target: step_b }
```

## Template variables

Reference variables in any string config field with `{{vars.name}}`:

```yaml
- id: deploy
  type: shell
  config:
    command: deploy.sh --env={{vars.environment}}
```

Variables are passed when triggering the runbook:
- CLI: `nanorun run my-runbook -v environment=production`
- SDK: `client.trigger('my-runbook', { variables: { environment: 'production' } })`
- Webhook: extracted from the incoming payload

## Contributing

Have a battle-tested runbook? PRs welcome. Keep templates:
- **Generic** — easy to adapt to any stack
- **Safe** — use approval gates for destructive ops
- **Documented** — explain required variables in the file header

## License

MIT
