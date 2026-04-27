# @operari/cli

Run [Operari](https://operari.dev) runbooks from your terminal.

## Install

```bash
npm install -g @operari/cli
```

## Quick start

```bash
# Login (interactive — paste your API key)
operari login

# Or login with flags
operari login --api-key nr_live_xxx --base-url https://api.operari.dev

# List your runbooks
operari list

# Run a runbook
operari run deploy-frontend

# Run with variables
operari run deploy-frontend -v env=production -v version=2.1.4

# Trigger and exit (don't wait)
operari run nightly-backup --async

# Get status of a previous run
operari status <run-id>
```

## Commands

### `operari login`

Save your API key to `~/.operari/config.json` (mode 0600).

Options:

- `--api-key <key>` — skip the prompt
- `--base-url <url>` — server URL (default: prompt or `http://localhost:4000`)

### `operari logout`

Delete saved credentials.

### `operari whoami`

Show current login info (key prefix only).

### `operari list` (alias: `ls`)

List all runbooks accessible to your API key.

### `operari run <slug>`

Trigger a runbook by slug or id and stream the output.

Options:

- `-v, --var <key=value>` — set a variable (repeatable)
- `--async` — trigger and return immediately, don't wait for completion
- `--timeout <seconds>` — max time to wait (default: 300)

Exits with code `0` on success, `1` on failure or timeout.

### `operari status <run-id>`

Get the status of a previous run.

## Use in CI

```yaml
# .github/workflows/deploy.yml
- name: Run deploy runbook
  run: |
    npx @operari/cli run deploy-prod \
      -v commit=$GITHUB_SHA \
      -v branch=$GITHUB_REF_NAME
  env:
    OPERARI_API_KEY: ${{ secrets.OPERARI_API_KEY }}
```

## License

MIT
