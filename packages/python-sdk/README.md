# operari

Official Python SDK for the Operari runbook automation API.

## Install

```bash
pip install operari
```

## Quick start

```python
from operari import Operari

client = Operari(api_key="nrk_...")

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

## Client API

| Method                          | Description                  |
| ------------------------------- | ---------------------------- |
| `list_runbooks()`               | List all runbooks            |
| `trigger(slug, variables=)`     | Trigger a runbook (async)    |
| `get_run(run_id)`               | Get run with step logs       |
| `list_runs(status=, limit=)`    | List recent runs             |
| `wait_for_completion(run_id)`   | Poll until terminal state    |
| `run(slug, variables=)`         | Trigger + wait (convenience) |
| `grant_approval(id, comment=)`  | Approve and resume           |
| `reject_approval(id, comment=)` | Reject and cancel            |
| `verify_audit()`                | Verify hash chain integrity  |

## Authoring custom step types in Python

Beyond the client, the SDK exposes a `define_step` surface that mirrors the
TypeScript `@operari/sdk/steps` API. A Python plugin runs as a subprocess: the
Operari backend writes one JSON envelope to stdin and reads `EMIT` / `RESULT`
lines back from stdout.

Minimal example:

```python
# my_plugin/hello_step.py
import sys
from operari.steps import (
    PluginContext,
    PluginResult,
    PluginStepProperty,
    define_step,
    run_cli,
)

def parse_config(raw):
    return raw  # or pydantic: MyModel.model_validate

def execute(config, context: PluginContext) -> PluginResult:
    context.emit("log", f"hi {config['name']}")
    return PluginResult(success=True, output={"greeted": config["name"]})

step = define_step(
    type="myorg.hello-world",
    config_schema=parse_config,
    execute=execute,
    label={"en": "Hello world", "es": "Hola mundo"},
    icon="MessageSquare",
    color="bg-emerald-500",
    properties=[
        PluginStepProperty(
            name="name",
            display_name="Name to greet",
            type="string",
            type_options={"expression": True},
        ),
    ],
)

if __name__ == "__main__":
    sys.exit(run_cli(step))
```

A complete runnable example lives in [`examples/hello_world/`](./examples/hello_world).
Smoke-test it without a backend:

```bash
echo '{"config":{"name":"world"},"context":{"runId":"r","stepId":"s","tenantId":"t","variables":{},"previousOutputs":{},"secrets":{}}}' \
  | python examples/hello_world/hello_step.py
```

You should see one `EMIT` line and one `RESULT` line.

### IPC contract

The Operari Node loader spawns one subprocess per step invocation and pipes a
single JSON envelope to stdin:

```json
{
  "config": { ... },
  "context": {
    "runId": "r1", "stepId": "s1", "tenantId": "t1",
    "variables": { ... }, "previousOutputs": { ... }, "secrets": { ... }
  }
}
```

Streaming events during execute (zero or more lines):

```text
EMIT {"type":"log","text":"..."}
EMIT {"type":"stdout","text":"..."}
```

Final result (exactly one line, after execute returns):

```text
RESULT {"success": true, "output": { ... }}
RESULT {"success": false, "error": "..."}
```

A plugin that uses `print()` will land lines without the prefix on stdout —
they get captured as raw output for debugging but never become structured log
events.

### Reserved type prefixes

`shell`, `approval`, `notify`, `wait`, `ssh`, `runbook`, and any `operari.*`
prefix are reserved by Operari core. `define_step` raises at import time if a
plugin tries to claim one — fail-fast at unit-test time instead of failing at
backend boot.

## License

MIT
