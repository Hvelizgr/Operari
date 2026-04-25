# @nanorun/cli

Run [NanoRun](https://nanorun.dev) runbooks from your terminal.

## Install

```bash
npm install -g @nanorun/cli
```

## Quick start

```bash
# Login (interactive — paste your API key)
nanorun login

# Or login with flags
nanorun login --api-key nr_live_xxx --base-url https://api.nanorun.dev

# List your runbooks
nanorun list

# Run a runbook
nanorun run deploy-frontend

# Run with variables
nanorun run deploy-frontend -v env=production -v version=2.1.4

# Trigger and exit (don't wait)
nanorun run nightly-backup --async

# Get status of a previous run
nanorun status <run-id>
```

## Commands

### `nanorun login`

Save your API key to `~/.nanorun/config.json` (mode 0600).

Options:

- `--api-key <key>` — skip the prompt
- `--base-url <url>` — server URL (default: prompt or `http://localhost:4000`)

### `nanorun logout`

Delete saved credentials.

### `nanorun whoami`

Show current login info (key prefix only).

### `nanorun list` (alias: `ls`)

List all runbooks accessible to your API key.

### `nanorun run <slug>`

Trigger a runbook by slug or id and stream the output.

Options:

- `-v, --var <key=value>` — set a variable (repeatable)
- `--async` — trigger and return immediately, don't wait for completion
- `--timeout <seconds>` — max time to wait (default: 300)

Exits with code `0` on success, `1` on failure or timeout.

### `nanorun status <run-id>`

Get the status of a previous run.

## Use in CI

```yaml
# .github/workflows/deploy.yml
- name: Run deploy runbook
  run: |
    npx @nanorun/cli run deploy-prod \
      -v commit=$GITHUB_SHA \
      -v branch=$GITHUB_REF_NAME
  env:
    NANORUN_API_KEY: ${{ secrets.NANORUN_API_KEY }}
```

## License

MIT
