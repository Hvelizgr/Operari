# MCP server (placeholder)

This directory will host the **Model Context Protocol** server that exposes
NanoRun primitives to external agents (Claude Desktop, Cursor, custom
agents).

It is intentionally empty today — see `IMPLEMENTACION_NANORUN.md` **P2
#16**. The pivot is the "structured knowledge layer" play: instead of
competing with general-purpose agents, NanoRun becomes the source of truth
they call into for runbook context.

## Planned tools

| Tool                  | Purpose                                            | Source of truth                      |
| --------------------- | -------------------------------------------------- | ------------------------------------ |
| `list_runbooks`       | Enumerate runbooks visible to the caller's API key | `backend/src/routes/v1/runbooks.ts`  |
| `get_runbook`         | Fetch a runbook definition by slug or id           | same                                 |
| `trigger_runbook`     | Start a run, return the run id (does not block)    | `backend/src/routes/v1/runs.ts`      |
| `get_run_status`      | Poll a run by id                                   | same                                 |
| `get_execution_logs`  | Stream or paginate logs for a run                  | `NodeLog` + audit chain              |
| `get_secret_metadata` | List secret names + scopes — **never the value**   | `ConnectedAccount` (encrypted)       |
| `verify_audit_chain`  | Run audit verification on demand                   | `backend/src/audit/audit.service.ts` |

## Constraints

- **No new auth surface.** The MCP server reuses existing API keys and
  scopes (`runbook:read`, `runbook:execute`, …). It is a transport, not a
  permission boundary.
- **Read-mostly by default.** `trigger_runbook` is the only mutating tool
  in v1; everything else is read.
- **Secrets are never returned in plaintext.** `get_secret_metadata` returns
  names and last-rotation timestamps only.
- **Audit every call.** Each MCP tool invocation emits an `AuditEvent` so
  agent activity is traceable in the same chain as human/CLI activity.

## Implementation notes (when we get here)

- Use `@modelcontextprotocol/sdk` (not `@mastra/mcp` — see ADR 0001).
- Run as a sub-process of the backend or as a stdio binary in `bin/`.
- Tests live next to the tools: `mcp/__tests__/<tool>.test.ts`.
