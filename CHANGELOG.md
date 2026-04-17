# Changelog

All notable changes to Cairn / NanoRun are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/). Dates are UTC.

## [Unreleased]

Pre-launch alpha sweep. Closed every code-only item in the v1 launch checklist.

### Added

- **Template canvas preview** — every template detail page now renders a static SVG mini-graph of the runbook (auto-laid-out with dagre) above the YAML block. Lets a visitor see the shape before reading code.
- **Production-grade Terms + Privacy** — replaced 5-section placeholders with 11-section Privacy and 17-section Terms, bilingual en/es. Covers GDPR lawful basis, retention, international transfers, SCCs, subprocessor notice, CCPA, SLA credits, indemnity, and export controls.
- **Audit log export** — `GET /api/v1/audit/export` (API-key, `audit:read` scope) and `GET /api/tenants/audit/export` (cookie-session, admin-only) stream the tenant audit chain as NDJSON for SIEM ingestion. Plan-gated to Business+. Each export records an `audit.exported` tombstone.
- **Tenant-wide MFA policy** — admins can toggle `Tenant.mfaRequired` on the Team panel. Non-enrolled users are routed to the enrollment page at next login. Self-lockout guard refuses to enable when the admin's own MFA is off.
- **GDPR self-serve account deletion** — `DELETE /api/auth/account` with password + TOTP reconfirm. Sole-member deletion cascades the tenant; members-present deletions require admin transfer first. Audit log keeps `user.deleted` / `tenant.deleted` tombstones.
- **Double-submit CSRF** — non-HttpOnly `nanorun_csrf` cookie minted alongside every session. Middleware enforces `X-CSRF-Token` header match on mutating methods when a session cookie is present. Gated via `CSRF_ENFORCE` env (off/observe/true) for phased rollout. Frontend `auth-client` injects the header automatically.
- **Account lockout** — 5 failures per 15-minute rolling window trips a 30-minute lock. `auth.login_failed` and `auth.account_locked` audit events. Response stays generic 401 to avoid enumeration leaks.
- **Sentry wiring** — `@sentry/node` integration gated by `SENTRY_DSN`. No-op when unset (self-host default). PII scrubber strips auth headers and password/token body keys before events leave the process.
- **Log redaction + uptime probes** — pino redacts `Authorization`, `Cookie`, `*.password`, `*.token`, signature headers, etc. before serializing. New `/live` endpoint for Kubernetes liveness and uptime monitors; `/health` stays as readiness (postgres + redis). `docs/OPS.md` ships recipes for UptimeRobot / Better Stack / Kubernetes probes and shipping pino JSON to Axiom / Loki / Datadog / CloudWatch.
- **HTML transactional emails** — zero-dep `email-templates.ts` renders password reset, email verification, workspace invite, and contact-form forwards as bilingual HTML+text pairs. Table-based layout for Gmail/Outlook/Apple Mail compatibility; CTA URLs sanitized; user content HTML-escaped.
- **Webhook debugger** — captures the last 50 receipts per webhook (accepted + rejected) with scrubbed headers and captured payloads. Inline UI panel with expandable receipt detail, status badges, and one-click replay.
- **Runbook job options** — authors can declare typed inputs (text / number / boolean / select). The Run dialog renders a form instead of the raw JSON textarea, with per-field validation and defaults.
- **First-run polish** — verified-email toast, dashboard empty state, post-upgrade welcome modal, QR code in MFA enrollment, 4-step onboarding tour.
- **Marketing landing rebrand** — trust bar of integration logos, scroll-triggered metrics counters (animejs), Hero parallax, navbar scroll-state with underline-slide hover, grain overlay, shimmer CTA — enterprise polish across the funnel.

### Changed

- `setSessionCookie` now internally mints the companion CSRF cookie, so every login / register / refresh / OAuth / invite-accept path gets the CSRF cookie without call-site changes.
- Login response shape: optional `mfaEnrollmentRequired: true` when the tenant requires MFA and the user hasn't enrolled.
- `/health` endpoint now returns `APP_VERSION` alongside the legacy `NANORUN_VERSION` fallback; same value Sentry uses as its release tag so errors correlate with uptime timestamps.

### Security

- Added AGPL-3.0 self-host license + MIT SDK/CLI license clauses in the public Terms, matching the LICENSE file.
- Runbook-level input schema validated server-side (Zod) on PUT; prevents malformed `inputs` arrays from reaching the Run dialog.

### Stats

- Backend: 887 tests / 88 suites passing.
- Frontend: typecheck clean, full `next build` succeeds, landing first-load JS ~166 kB.
