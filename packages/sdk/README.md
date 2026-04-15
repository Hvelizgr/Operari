# @cairn/sdk

Official Node.js SDK for [NanoRun](https://nanorun.dev) — visual runbooks for engineers.

## Install

```bash
npm install @cairn/sdk
```

## Quick start

```ts
import { NanoRun } from '@cairn/sdk';

const client = new NanoRun({
  apiKey: process.env.NANORUN_API_KEY!,
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

### `new NanoRun(config)`
- `config.apiKey` (required) — your API key starting with `nr_live_` or `nr_test_`
- `config.baseURL` (optional) — defaults to `https://api.nanorun.dev`
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

## License

MIT
