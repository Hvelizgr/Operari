# operari-slack-notify-starter

TypeScript starter for an Operari plugin. Copy this folder, rename it,
and you've got a known-good template that already wires up:

- `defineStep()` from `@operari/sdk/steps`
- a real zod schema with per-field constraints
- outbound HTTP via global `fetch` with an explicit timeout
- structured success/failure returns + `emit()` log lines
- `tsc` build pipeline + `vitest` unit tests against a stubbed `fetch`

The minimal `examples/plugins/hello-world` shows the raw CJS contract;
this one shows the shape a real production plugin lands on.

## Layout

```
slack-notify-starter/
├── package.json        # operari.steps points at dist/index.js
├── tsconfig.json       # CJS output, strict mode, dist/ rootDir
├── src/
│   ├── index.ts        # the plugin
│   └── index.test.ts   # vitest suite — mocks global fetch
└── dist/               # tsc output (gitignored in real installs)
```

## Build & test

```bash
cd examples/plugins/slack-notify-starter
npm install        # zod + typescript + vitest + @types/node
npm run typecheck
npm test
npm run build      # writes dist/index.js
```

## Try it in a self-host stack

```bash
mkdir -p ./plugins
cp -r examples/plugins/slack-notify-starter ./plugins/
cd ./plugins/slack-notify-starter && npm install && npm run build && cd -
OPERARI_PLUGINS_DIR=$(pwd)/plugins docker compose up
```

Then drop a step into a runbook:

```yaml
- id: notify_oncall
  type: example.slack-notify
  config:
    webhookUrl: '{{secrets.<connected-account-id>}}' # or a literal
    message: 'Deploy {{vars.version}} hit prod ✅'
    channel: '#ops-alerts'
    timeoutMs: 5000
```

## Conventions worth keeping when you fork this

- **Namespace your `type`.** `<org>.<step-name>`. Plain names collide
  with reserved core types (`shell`, `approval`, `notify`, `wait`,
  `ssh`, `runbook`, `operari.*`) and the loader rejects them at
  startup.
- **Always pass an `AbortController` to `fetch`.** A vendor that
  hangs at 3am should fail your step, not your engine.
- **Return failures, don't throw.** Both work — the loader catches —
  but explicit `{ success: false, error }` reads cleaner in the run
  detail page than a generic stack trace.
- **Read secrets via `context.secrets[id]`.** The orchestrator
  pre-resolves `{{secrets.<id>}}` references in your config. Never
  hand-fetch from the secrets vault inside `execute`.

## Dev loop

If you set `OPERARI_PLUGINS_DIR` before starting the backend with
`npm run dev`, the dev orchestrator (`backend/scripts/dev-with-plugins.mjs`)
adds your plugin folder to the watcher — running `npm run build` inside
your plugin triggers a backend respawn and the new bytes get loaded
without a manual restart.
