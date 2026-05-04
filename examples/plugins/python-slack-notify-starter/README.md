# operari-py-slack-notify-starter

Python equivalent of `slack-notify-starter` (TypeScript). Copy this
folder, rename it, and you've got a known-good template that already
wires up:

- `define_step()` from `operari.steps`
- a real pydantic `BaseModel` schema with per-field constraints
- outbound HTTP via `requests` with an explicit timeout
- structured success/failure returns + `ctx.emit('log', ...)` lines
- `pytest` suite against a stubbed slack webhook (`responses` lib)

The minimal `packages/python-sdk/examples/hello_world` shows the raw
loader contract; this one shows the shape a real production plugin
lands on.

## Layout

```
python-slack-notify-starter/
├── operari.json          # language=python + entry path; loader reads this
├── pyproject.toml        # operari + pydantic + requests deps; pytest config
├── src/plugin/
│   ├── __init__.py
│   └── slack_notify.py   # the plugin
└── tests/
    └── test_slack_notify.py   # config + happy path + 4xx + timeout
```

## Build & test

```bash
cd examples/plugins/python-slack-notify-starter
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
pytest
```

## Try it in a self-host stack

```bash
mkdir -p ./plugins
cp -r examples/plugins/python-slack-notify-starter ./plugins/
cd ./plugins/python-slack-notify-starter && pip install -e . && cd -
OPERARI_PLUGINS_DIR=$(pwd)/plugins \
OPERARI_PYTHON_BIN=$(which python) \
docker compose up
```

The Python loader path reads `operari.json`, spawns
`python src/plugin/slack_notify.py` per step invocation, pipes the
config + context as JSON on stdin, and reads `EMIT` / `RESULT` lines
back from stdout. The wire protocol lives in
[`packages/python-sdk/src/operari/steps/ipc.py`](../../../packages/python-sdk/src/operari/steps/ipc.py).

Then drop a step into a runbook:

```yaml
- id: notify_oncall
  type: example.py-slack-notify
  config:
    webhook_url: '{{secrets.<connected-account-id>}}'
    message: 'Deploy {{vars.version}} hit prod ✅'
    channel: '#ops-alerts'
    timeout_ms: 5000
```

## Conventions worth keeping when you fork this

- **Namespace your `type`.** `<org>.<step-name>`. Plain names collide
  with reserved core types and the loader rejects them at startup.
- **Always pass `timeout=` to `requests`.** A vendor that hangs at
  3am should fail your step, not your engine. `requests.post(...)`
  without a timeout blocks forever.
- **Return PluginResult, don't throw.** Both work — the loader
  catches — but explicit `PluginResult(success=False, error=...)`
  reads cleaner in the run detail page than a Python traceback.
- **Read secrets via `ctx.secrets[id]`.** The orchestrator
  pre-resolves `{{secrets.<id>}}` references. Never hand-fetch from
  the secrets vault inside `execute`.
- **Prefer pydantic over hand-rolled validation.** Free per-field
  error messages, clean dump-to-dict for the wire format, easy to
  generate JSON Schema later for editor form integration.

## Dev loop

The dev orchestrator (`backend/scripts/dev-with-plugins.mjs`)
watches `OPERARI_PLUGINS_DIR` and triggers a backend respawn on file
changes. For Python plugins the in-process hot-reload (require.cache
invalidation) doesn't apply — but the ts-node-dev respawn covers
edits to `operari.json` + `*.py` files.

For tighter iteration, run your tests in watch mode in a side
terminal:

```bash
ptw    # via pip install pytest-watch
```
