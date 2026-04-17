# example/cairn-hello-world

Minimal plugin that shows the `defineStep()` contract Cairn uses to
load user-authored step executors at boot.

## How it works

1. `package.json` declares a `cairn.steps` field pointing to the
   compiled entry files. The loader reads this on startup, so
   TypeScript plugins must ship their built output in the package.
2. Each entry file's default export is a descriptor with
   `{ type, configSchema, execute }`. The loader validates the shape,
   runs `configSchema.parse()` on every call before invoking
   `execute`, and catches any throw so a buggy plugin can't crash
   the engine.
3. `example.hello-world` is namespaced — core step types
   (`shell`, `approval`, `notify`, `wait`, `ssh`, `runbook`,
   `nanorun.*`, `cairn.core.*`) are reserved and will be rejected.

## Try it

```bash
# Self-host with docker compose
mkdir -p ./plugins
cp -r examples/plugins/hello-world ./plugins/
NANORUN_PLUGINS_DIR=/app/plugins docker compose up
```

Then create a runbook with a step:

```yaml
- id: say_hi
  type: example.hello-world
  config:
    name: Cairn
```

## Authoring a real plugin

```ts
// src/index.ts
import { defineStep } from '@cairn/sdk/steps';
import { z } from 'zod';

export default defineStep({
  type: 'myorg.slack-notify',
  configSchema: z.object({
    webhook: z.string().url(),
    message: z.string(),
  }),
  async execute(config, context) {
    await fetch(config.webhook, {
      method: 'POST',
      body: JSON.stringify({ text: config.message }),
    });
    return { success: true, output: { delivered: true } };
  },
});
```

Compile with `tsc`, ship the package with `cairn.steps` pointing at
`dist/index.js`, drop the built folder into `NANORUN_PLUGINS_DIR`.
