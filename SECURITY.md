# Security Policy

NanoRun executes user-defined commands. We take security reports seriously.

## Reporting a vulnerability

**Do not open a public GitHub issue.** Instead, email:

> **security@nanorun.dev**

Please include:

- A clear description of the issue and the impact you observed
- Steps to reproduce (a minimal runbook, request, or repro repo)
- The affected version / commit SHA
- Any logs, stack traces, or screenshots that help us triage
- Whether you would like public credit and how to be credited

We will acknowledge receipt within **3 business days** and aim to provide a
remediation plan within **10 business days**. Critical issues (RCE, auth
bypass, secret disclosure, tenant isolation breaks) are handled with priority.

We will not pursue legal action against researchers who:

- Report in good faith
- Avoid privacy violations, data destruction, and service disruption
- Give us a reasonable window to remediate before public disclosure

## Supported versions

NanoRun is in **alpha**. Only the `main` branch receives security fixes.
Once we cut a `0.x` release, we will support the latest minor.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| `< 0.1` | :x:                |

## Scope

In scope:

- The `backend/`, `frontend/`, `packages/sdk`, and `packages/cli` source trees
- Default Docker images shipped from this repository
- The hosted `app.nanorun.dev` instance once it goes live

Out of scope:

- Self-hosted deployments running modified forks
- Vulnerabilities in third-party dependencies that have a fix already
  available — please upgrade and verify before reporting
- Findings that require physical access, social engineering, or DoS

## Known caveats

These are documented trade-offs, not vulnerabilities — please do not file
reports for them unless you have a concrete escalation:

- **`LocalRunner` is single-tenant only.** Configuring `NANORUN_RUNNER=local`
  on a multi-tenant deployment is unsupported. Use `docker` or `fly` for
  multi-tenant. See `backend/src/runbook/runners/local.runner.ts`.
- **Self-host JWT secret rotation requires a restart.** Documented in
  `backend/.env.example`.
- **The audit chain detects tampering, it does not prevent it.** A DBA with
  raw Postgres access can drop rows; verification will then fail loudly via
  `cairn audit verify`.

## Cryptography

- Secret-at-rest: XChaCha20-Poly1305 via `libsodium-wrappers`
  (`backend/src/security/secret-cipher.ts`)
- Audit chain: SHA-256 hash chain over canonical JSON
  (`backend/src/audit/`)
- Transport: TLS is the operator's responsibility — terminate at your
  reverse proxy

## Hall of fame

We will list researchers who have responsibly disclosed issues here once we
have our first report. Thank you in advance.
