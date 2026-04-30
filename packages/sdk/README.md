# @operari/sdk

Official Node.js SDK for Operari — visual runbooks for engineers.

## Install

```bash
npm install @operari/sdk
```

## Quick start

```ts
import { Operari } from '@operari/sdk';

const client = new Operari({
  apiKey: process.env.OPERARI_API_KEY!,
  baseURL: 'http://localhost:4000', // omit for production
});

// Trigger a runbook (async)
const run = await client.trigger('deploy-frontend', {
  variables: { env: 'production', version: '2.1.4' },
});

console.log(`Run started: ${run.url}`);

// Wait for completion
const final = await client.waitForCompletion(run.id);
console.log(`Status: ${final.status}, Duration: ${final.duration}ms`);

// Or do both in one call
const result = await client.run('deploy-frontend', {
  variables: { env: 'production' },
  timeoutMs: 10 * 60 * 1000,
});
```

## API

### `new Operari(config)`

- `config.apiKey` (required) — your API key starting with `nr_live_` or `nr_test_`
- `config.baseURL` (optional) — defaults to `https://api.operari.dev`
- `config.fetch` (optional) — custom fetch implementation

### `client.listRunbooks()`

List all runbooks accessible to your API key.

### `client.trigger(slugOrId, options?)`

Trigger a runbook by slug or id. Returns immediately with the run record.

### `client.getRun(runId)`

Get the current state of a run.

### `client.waitForCompletion(runId, options?)`

Poll until the run reaches a terminal state.

### `client.run(slugOrId, options?)`

Convenience: trigger AND wait. Throws if the run fails.

## Authoring custom step types

`@operari/sdk/steps` exposes a `defineStep` helper that mirrors the runtime
contract Operari's plugin loader expects. A plugin module's default export is
the descriptor returned by `defineStep`:

```ts
import { defineStep, propertiesFromZod } from '@operari/sdk/steps';
import { z } from 'zod';

const schema = z.object({
  webhookUrl: z.string().url().describe('Slack webhook URL'),
  message: z.string().describe('Message body'),
  severity: z.enum(['info', 'warning', 'error']).default('info'),
  verbose: z.boolean().default(false).describe('Include the full payload'),
});

export default defineStep({
  type: 'myorg.slack-notify',
  configSchema: schema,
  // Auto-derived form metadata. The editor's PropertiesPanel renders
  // a real form (text inputs, select for `severity`, toggle for
  // `verbose`) instead of falling back to a JSON textarea.
  properties: propertiesFromZod(schema),
  label: { en: 'Slack notify', es: 'Notificar Slack' },
  icon: 'Send',
  color: 'bg-pink-500',
  category: 'integrations',
  async execute(config, context) {
    await fetch(config.webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: config.message }),
    });
    return { success: true, output: { delivered: true } };
  },
});
```

`zod` is an optional peer dependency. Plugin authors who use yup or arktype
can write the `properties` array by hand (or skip it; the editor falls back
to the JSON textarea automatically).

### `propertiesFromZod(schema)`

Converts a `z.object({...})` schema into a `PluginStepProperty[]` the editor
can render. Supports:

| zod                                | property                              |
| ---------------------------------- | ------------------------------------- |
| `z.string()`                       | `string`                              |
| `z.number()`                       | `number`                              |
| `z.boolean()`                      | `boolean`                             |
| `z.enum([...])`                    | `options` with one choice per value   |
| `z.literal('foo')` (string)        | `options` with a single choice        |
| `z.nativeEnum(StringEnum)`         | `options`                             |
| `.optional()` / `.nullable()`      | unwrapped + carried description       |
| `.default(value)`                  | unwrapped + populated `default`       |
| `.refine(...)` / `.transform(...)` | unwrapped to the underlying primitive |
| `.describe('...')`                 | populated `description`               |

Anything else (arrays, unions of mixed kinds, intersections, records) is
silently dropped from the form — the runtime parse still validates it, the
editor just falls back to its default behavior for that field.

## License

MIT
