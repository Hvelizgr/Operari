// Reaches into the SDK's built dist because the backend's tsconfig
// rootDir is scoped to backend/src. Typed locally to avoid pulling
// the SDK's .ts sources into the backend compilation unit.
interface DefineStepOptions<T> {
  type: string;
  configSchema: { parse: (input: unknown) => T };
  execute: (config: T, context: unknown) => Promise<unknown>;
}
interface DefineStepFn {
  <T>(options: DefineStepOptions<T>): DefineStepOptions<T>;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { defineStep } = require('../../../../packages/sdk/dist/steps/define-step') as {
  defineStep: DefineStepFn;
};

/**
 * Integration-style tests for the SDK's defineStep helper. We live in
 * the backend package so we can run under the existing Jest config
 * without adding a test runner to the SDK package. The import reaches
 * into packages/sdk/src directly (TS sources, not the built dist) so
 * the assertion is against the canonical source of truth.
 *
 * The loader tests already exercise the happy path end-to-end; these
 * cases focus on the input-validation guards that keep a well-meaning
 * plugin author honest before they ship to a real NanoRun.
 */

describe('defineStep', () => {
  const validSchema = { parse: (x: unknown) => x };
  const validExecute = async () => ({ success: true });

  it('returns a descriptor when all required fields are present', () => {
    const step = defineStep({
      type: 'example.ok',
      configSchema: validSchema,
      execute: validExecute,
    });

    expect(step.type).toBe('example.ok');
    expect(step.configSchema).toBe(validSchema);
    expect(step.execute).toBe(validExecute);
  });

  it('rejects a missing options object', () => {
    expect(() => defineStep(undefined as unknown as Parameters<typeof defineStep>[0])).toThrow(
      /options object/
    );
  });

  it('rejects a missing or empty type string', () => {
    expect(() =>
      defineStep({
        type: '',
        configSchema: validSchema,
        execute: validExecute,
      } as Parameters<typeof defineStep>[0])
    ).toThrow(/type/);
    expect(() =>
      defineStep({
        configSchema: validSchema,
        execute: validExecute,
      } as unknown as Parameters<typeof defineStep>[0])
    ).toThrow(/type/);
  });

  it('rejects a configSchema that is not parse()-able', () => {
    expect(() =>
      defineStep({
        type: 'example.ok',
        configSchema: {} as Parameters<typeof defineStep>[0]['configSchema'],
        execute: validExecute,
      })
    ).toThrow(/parse/);
  });

  it('rejects a non-function execute', () => {
    expect(() =>
      defineStep({
        type: 'example.ok',
        configSchema: validSchema,
        execute: 'not a function' as unknown as Parameters<typeof defineStep>[0]['execute'],
      })
    ).toThrow(/execute/);
  });

  it('preserves zod-like schema inference chains', async () => {
    // Hand-rolled schema to avoid depending on zod in this test —
    // the shape is what matters. The plugin loader tests (with
    // real require + validate paths) are the integration guardrail.
    const schema = {
      parse: (input: unknown) => {
        if (
          input &&
          typeof input === 'object' &&
          'name' in input &&
          typeof (input as { name: unknown }).name === 'string'
        ) {
          return { name: (input as { name: string }).name.toUpperCase() };
        }
        throw new Error('name must be a string');
      },
    };

    const step = defineStep({
      type: 'example.transform',
      configSchema: schema,
      execute: async config => ({
        success: true,
        output: { shouted: config.name },
      }),
    });

    const parsed = step.configSchema.parse({ name: 'alice' });
    expect((parsed as { name: string }).name).toBe('ALICE');

    const result = (await step.execute(parsed, {
      runId: 'r',
      stepId: 's',
      tenantId: 't',
      variables: {},
      previousOutputs: {},
      secrets: {},
      emit: () => undefined,
    })) as { success: boolean; output: { shouted: string } };
    expect(result.success).toBe(true);
    expect(result.output).toEqual({ shouted: 'ALICE' });
  });
});
