# Contributing to NanoRun

Thanks for your interest in NanoRun! This document explains how to get the project running locally, how the codebase is organized, and how to send a change that has a good chance of being merged.

NanoRun is in **alpha**. APIs, schemas, and internal structure are still moving. If you plan a non-trivial change, please open an issue first so we can align on direction before you spend time on a PR.

---

## Code of conduct

By participating in this project you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md). In short: be kind, assume good intent, and focus on the work.

---

## Repository layout

```
nanorun/
├── backend/         AGPL-3.0 — server, executor, runbook engine, AI agent, API
├── frontend/        AGPL-3.0 — Next.js editor, canvas, real-time collab
├── packages/
│   ├── sdk/         MIT — TypeScript SDK to trigger runbooks from your code
│   ├── cli/         MIT — `nanorun` CLI
│   └── shared/      Shared types between server, SDK and frontend
├── templates/       MIT — example runbooks (deploys, migrations, onboarding…)
└── docs/            User-facing documentation
```

The split between AGPL (server + frontend) and MIT (SDK + CLI + templates) is intentional: it lets you embed the SDK and CLI in any project without restrictions, while preventing third parties from offering NanoRun as a hosted service without contributing back.

---

## Getting set up

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10 (the repo uses npm workspaces)
- **PostgreSQL** ≥ 14 (or use the bundled `docker-compose.yml`)
- **Docker** + **Docker Compose** (recommended for the database and for running sandboxed nodes)

### Clone and install

```bash
git clone https://github.com/your-org/nanorun.git
cd nanorun
npm install
```

### Configure the backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set DATABASE_URL and JWT_SECRET
```

### Bring up Postgres + the server

```bash
docker compose up -d postgres
npm run db:migrate --workspace backend
npm run dev --workspace backend
```

### Bring up the frontend

```bash
npm run dev --workspace frontend
# → http://localhost:3000
```

---

## Running tests

```bash
# Backend (Vitest)
npm run test --workspace backend

# Frontend (Vitest + Testing Library)
npm run test --workspace frontend

# SDK
npm run test --workspace @cairn/sdk
```

A PR that touches code without an accompanying test is unlikely to be merged unless the change is purely cosmetic.

---

## How to send a change

1. **Open an issue first** for anything bigger than a typo or a one-line fix. This avoids wasted work on changes we can't accept for design reasons.
2. **Fork** the repo and create a branch from `main` named `feat/<short-description>`, `fix/<short-description>`, or `docs/<short-description>`.
3. **Make focused commits.** One logical change per commit. Don't bundle a refactor with a feature with a fix.
4. **Follow the commit-message convention** (see below).
5. **Run the tests and the linter** before pushing:
   ```bash
   npm run lint
   npm run test
   ```
6. **Open a pull request** against `main`. Fill in the PR template — what, why, how to verify, screenshots if UI.
7. **Respond to review.** We try to review within a few days. Please don't take feedback personally — we comment on the code, not the contributor.

### Commit message convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body explaining the *why*>

<optional footer with BREAKING CHANGE: notes or issue refs>
```

Allowed `<type>` values: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Examples:

```
feat(executor): add timeout support to shell nodes
fix(editor): prevent duplicate edges when reconnecting
docs(readme): clarify self-host quickstart for Docker users
```

The repo enforces this with `commitlint` — non-conforming commits will fail the pre-commit hook.

---

## What kind of changes we welcome

**Yes please:**

- Bug fixes with a regression test
- New runbook templates in `templates/` (real-world, well-documented)
- New executor node types (HTTP, approval, conditional, etc.)
- Documentation, examples, typo fixes
- Accessibility and i18n improvements
- Performance fixes with a benchmark

**Please open an issue first:**

- New integrations (Sentry, Datadog, Slack…) — we want to align on the abstraction
- Schema changes to the runbook format
- New external dependencies — we keep the dependency tree small on purpose
- Anything that touches auth, billing, or the executor sandbox

**We will likely decline:**

- Style-only refactors that don't fix a real problem
- "Improvements" that add configurability for hypothetical use cases
- Renaming variables, adding comments to code you didn't change
- Changes that broaden the AGPL/MIT boundary without a discussion

---

## Reporting bugs

Open an issue with:

1. What you did
2. What you expected
3. What actually happened
4. How to reproduce (a runbook export or a curl command is gold)
5. Versions: NanoRun, Node, OS, browser if relevant

For security issues, **do not open a public issue.** See [SECURITY.md](./SECURITY.md).

---

## Releasing (maintainers only)

Releases are cut from `main` using `npm version` in the affected workspace, then pushed with tags. CI builds the Docker image and publishes packages to npm.

---

## Questions

Open a [discussion](https://github.com/your-org/nanorun/discussions) or ping us in the project chat (link in the README). Thanks for helping make NanoRun better.
