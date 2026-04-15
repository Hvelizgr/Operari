# Audit event coverage

**Last verified:** 2026-04-07
**Source of truth for the union:** `backend/src/audit/audit.service.ts`
**Required minimum:** `IMPLEMENTACION_NANORUN.md` P0 #2

> *"Eventos mínimos: ejecución iniciada/completada, nodo ejecutado,
> aprobación dada, secret accedido, runbook editado, API key usada."*

## Coverage matrix

Legend:
- ✅ defined in the union **and** emitted from production code
- 🟡 defined in the union, no producer yet (feature not built or wrapper missing)
- ❌ required by the roadmap, not even defined

| Required (P0 #2)        | Event type           | Producer                                                              | Status |
| ----------------------- | -------------------- | --------------------------------------------------------------------- | :----: |
| ejecución iniciada      | `run.started`        | `editor/execution/execution.service.ts:149`                           |   ✅   |
| ejecución completada    | `run.completed`      | `editor/execution/execution.service.ts:669`                           |   ✅   |
| ejecución completada    | `run.failed`         | `editor/execution/execution.service.ts:708`                           |   ✅   |
| —                       | `run.paused`         | `editor/execution/execution.service.ts:512`                           |   ✅   |
| —                       | `run.resumed`        | `editor/execution/execution.service.ts:297`                           |   ✅   |
| —                       | `run.cancelled`      | `routes/execution.routes.ts:316`                                      |   ✅   |
| nodo ejecutado          | `step.completed`     | `editor/execution/execution.service.ts:549`                           |   ✅   |
| nodo ejecutado          | `step.failed`        | `editor/execution/execution.service.ts:602`                           |   ✅   |
| —                       | `step.skipped`       | `editor/execution/execution.service.ts:415`                           |   ✅   |
| aprobación dada         | `approval.requested` | `runbook/executors/approval.executor.ts:95`                           |   ✅   |
| aprobación dada         | `approval.granted`   | `runbook/services/approval.service.ts:174`                            |   ✅   |
| aprobación dada         | `approval.rejected`  | `runbook/services/approval.service.ts:174`                            |   ✅   |
| runbook editado         | `runbook.created`    | `routes/workflow.routes.ts:371,488,700`                               |   ✅   |
| runbook editado         | `runbook.updated`    | `routes/workflow.routes.ts:546`                                       |   ✅   |
| runbook editado         | `runbook.deleted`    | `routes/workflow.routes.ts:631`                                       |   ✅   |
| API key usada           | `apikey.created`     | `runbook/services/api-key.service.ts:78`                              |   ✅   |
| API key usada           | `apikey.used`        | `runbook/services/api-key.service.ts:123`                             |   ✅   |
| API key usada           | `apikey.revoked`     | `runbook/services/api-key.service.ts:176`                             |   ✅   |
| —                       | `auth.login`         | `routes/auth.routes.ts:178,295`                                       |   ✅   |
| —                       | `auth.logout`        | `routes/auth.routes.ts:457`                                           |   ✅   |
| **secret accedido**     | `secret.accessed`    | `security/secret-reader.ts` — emitted on every `read()`               |   ✅   |
| —                       | `role.granted`       | `rbac/role-assignment.service.ts` — emitted on every `grant()`        |   ✅   |
| —                       | `role.revoked`       | `rbac/role-assignment.service.ts` — emitted on every `revoke()`       |   ✅   |
| —                       | `connectedaccount.linked`   | `security/connected-account.service.ts` — emitted on every `link()`   |   ✅   |
| —                       | `connectedaccount.unlinked` | `security/connected-account.service.ts` — emitted on every `unlink()` |   ✅   |

## Gaps and decisions

### `secret.accessed` — closed by `SecretReader`

`SecretCipher.decrypt()` is a pure crypto primitive with no awareness of
who or why. Wrapping it in audits inside the cipher itself would couple
crypto to the audit chain. Instead we ship a thin
`backend/src/security/secret-reader.ts` that takes a `SecretCipher` plus
an `AuditService` and exposes `read({ tenantId, actorId, actorType,
resource, payload })`. **Every consumer of stored secrets MUST go
through `SecretReader`, not `SecretCipher` directly.** Tests enforce
that `secret.accessed` is recorded on success and that decryption
failures still emit a `secret.accessed` payload with `success: false`
so we can spot brute-force attempts.

First production consumer: `ConnectedAccountService.getAccessToken()` /
`getRefreshToken()`. Both go through `SecretReader.read()` and tests
verify the `secret.accessed` event is emitted with the right actor,
resource, and reason on every call.

### `run.cancelled` — wired to the existing cancel endpoint

`POST /executions/:id/cancel` (`routes/execution.routes.ts:282`) was
already in the codebase but did not audit. It now emits `run.cancelled`
on the same fire-and-forget pattern as the rest of the chain. The
status transition to `CANCELLED` and the audit row are not in a single
transaction — if the audit write fails the run is still cancelled and
the operator's intent is preserved (logged at error level for the
verifier to flag later).

### `auth.logout` — stateless, but recorded

JWT in NanoRun is stateless: the server cannot truly invalidate a token
mid-flight. We added `POST /auth/logout` anyway because the audit chain
is what compliance dashboards and incident timelines actually consume —
"who logged out from where, and when" is the question, not "is this
specific JWT still valid". The endpoint requires authentication and
records `auth.logout` with `method: 'client-initiated'`, IP, and user
agent. Real revocation (denylist or short-lived tokens with refresh)
is a separate work item; when it ships, the revocation handler emits
the same event type, and any existing dashboard queries keep working.

## Events outside the P0 #2 minimum that we should consider

These are **not** required for the first Show HN but should be added
before we onboard a paying customer with compliance needs:

- `tenant.created`, `tenant.deleted`
- `user.invited`, `user.removed`
- ~~`connectedaccount.linked`, `connectedaccount.unlinked`~~ — paired with
  `secret.accessed`, this lets us answer "who connected this Slack
  workspace"
- `key.rotated` — when `NANORUN_SECRET_KEY` rotates, log the
  fingerprint transition (not the keys themselves) so we can
  cross-reference any subsequent decrypt failures

Each of these is a one-line addition to the `AuditEventType` union plus
a `safeAudit` call at the relevant write site.

## Verification

- `cairn audit verify` (`packages/cli/src/commands/audit/verify.ts`)
  walks the chain per tenant and reports any tampering.
- `__tests__/audit/audit.service.test.ts` and
  `__tests__/audit/execution-audit.test.ts` cover the emit paths above.
- This document should be re-checked whenever `AuditEventType` gains a
  new variant — grep for `safeAudit\(` and update the matrix.
