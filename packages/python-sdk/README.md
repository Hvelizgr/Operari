# cairn

Official Python SDK for the [NanoRun](https://github.com/hvelizg/NanoFlow) runbook automation API.

## Install

```bash
pip install cairn
```

## Quick start

```python
from cairn import NanoRun

client = NanoRun(api_key="nrk_...")

# Trigger and wait
run = client.run("deploy-frontend", variables={"env": "production"})
print(run.status)  # RunStatus.SUCCESS

# List failed runs
for r in client.list_runs(status="FAILED", limit=5):
    print(f"{r.runbook['name']}: {r.error}")

# Approve a gate
client.grant_approval("approval-uuid", comment="LGTM")

# Verify audit chain
result = client.verify_audit()
assert result.intact
```

## API

| Method | Description |
|--------|-------------|
| `list_runbooks()` | List all runbooks |
| `trigger(slug, variables=)` | Trigger a runbook (async) |
| `get_run(run_id)` | Get run with step logs |
| `list_runs(status=, limit=)` | List recent runs |
| `wait_for_completion(run_id)` | Poll until terminal state |
| `run(slug, variables=)` | Trigger + wait (convenience) |
| `grant_approval(id, comment=)` | Approve and resume |
| `reject_approval(id, comment=)` | Reject and cancel |
| `verify_audit()` | Verify hash chain integrity |

## License

MIT
