// Plain CJS so the plugin loader can `require()` this without a
// build step. Real plugins will typically author in TypeScript with
// zod and `defineStep()` imported from '@nanorun/sdk/steps', then
// compile to this shape. We keep the example raw so a self-host
// user can copy the file and modify it in place.
//
// Shape expected by the loader:
//   { type: string, configSchema: { parse(input): T }, execute(config, context): Promise<Result> }
//
// configSchema here is a tiny hand-rolled validator so the example
// has zero runtime deps. In production you'd use zod:
//   const schema = z.object({ name: z.string().min(1) });

const schema = {
  parse(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('config must be an object');
    }
    if (typeof input.name !== 'string' || input.name.length === 0) {
      throw new Error('config.name is required and must be a non-empty string');
    }
    return { name: input.name };
  },
};

module.exports = {
  type: 'example.hello-world',
  configSchema: schema,
  async execute(config, context) {
    context.emit({
      type: 'log',
      text: `hello, ${config.name} — from run ${context.runId}`,
    });
    return {
      success: true,
      output: { greeted: config.name, at: new Date().toISOString() },
    };
  },
};
