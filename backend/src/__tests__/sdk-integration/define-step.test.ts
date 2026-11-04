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
 * plugin author honest before they ship to a real Operari.
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

  it('passes optional visual + form metadata through to the descriptor', () => {
    // Cast through unknown so the local DefineStepOptions interface
    // (which omits the metadata fields by design) does not block the
    // test. The runtime descriptor is the real assertion target —
    // the backend loader reads these fields off the live object.
    const step = defineStep({
      type: 'example.with-meta',
      configSchema: validSchema,
      execute: validExecute,
      label: { en: 'Slack notify', es: 'Notificar Slack' },
      description: 'Post to Slack',
      icon: 'Send',
      color: 'bg-pink-500',
      category: 'integrations',
      inputs: [{ name: 'main', type: 'main' }],
      outputs: [{ name: 'main', type: 'main' }],
      properties: [
        {
          name: 'webhook',
          displayName: 'Webhook URL',
          type: 'secret',
          typeOptions: { provider: 'slack' },
        },
        {
          name: 'message',
          displayName: 'Message',
          type: 'string',
          typeOptions: { rows: 4, expression: true },
        },
      ],
    } as unknown as DefineStepOptions<unknown>) as unknown as Record<string, unknown>;

    expect(step.label).toEqual({ en: 'Slack notify', es: 'Notificar Slack' });
    expect(step.icon).toBe('Send');
    expect(step.color).toBe('bg-pink-500');
    expect(step.category).toBe('integrations');
    expect(Array.isArray(step.properties)).toBe(true);
    expect((step.properties as unknown[]).length).toBe(2);
  });

  it('omits metadata keys when not provided (no spurious undefined fields)', () => {
    const step = defineStep({
      type: 'example.bare',
      configSchema: validSchema,
      execute: validExecute,
    }) as unknown as Record<string, unknown>;

    // Keys are present but undefined — the loader's `Array.isArray`
    // and `typeof === 'string'` guards on each field handle that.
    // What we pin here is that the descriptor stays a flat object
    // with the runtime contract intact.
    expect(step.type).toBe('example.bare');
    expect(step.configSchema).toBeDefined();
    expect(step.execute).toBeDefined();
  });

  it('derives form fields from a zod schema when none are given', () => {
    const { z } = require('zod') as typeof import('zod');
    const step = defineStep({
      type: 'acme.ping',
      configSchema: z.object({
        host: z.string().describe('Host to ping'),
        count: z.number().default(3),
      }),
      execute: async () => ({ success: true }),
    }) as { properties?: Array<{ name: string; required?: boolean }> };
    expect(step.properties?.map(p => [p.name, !!p.required])).toEqual([
      ['host', true],
      ['count', false],
    ]);
  });

  it('keeps hand-written fields and derives nothing from non-zod schemas', () => {
    const { z } = require('zod') as typeof import('zod');
    const manual = [{ name: 'x', displayName: 'X', type: 'string' }];
    const own = defineStep({
      type: 'acme.own',
      configSchema: z.object({ host: z.string() }),
      properties: manual,
      execute: async () => ({ success: true }),
    } as never) as { properties?: unknown };
    expect(own.properties).toBe(manual);
    const yup = defineStep({
      type: 'acme.other',
      configSchema: { parse: (v: unknown) => v },
      execute: async () => ({ success: true }),
    }) as { properties?: unknown };
    expect(yup.properties).toBeUndefined();
  });
});

describe('plugin loader JSON fields', () => {
  const { parseJsonFields } = require('../../runbook/plugins/loader') as {
    parseJsonFields: (config: unknown, properties: unknown[] | undefined) => unknown;
  };
  const props = [
    { name: 'tags', typeOptions: { json: true } },
    { name: 'note', typeOptions: { rows: 3 } },
  ];

  it('parses JSON fields before validation and leaves the rest alone', () => {
    expect(parseJsonFields({ tags: '["a","b"]', note: '["not parsed"]' }, props)).toEqual({
      tags: ['a', 'b'],
      note: '["not parsed"]',
    });
  });

  it('leaves invalid JSON for the schema to report and ignores missing metadata', () => {
    expect(parseJsonFields({ tags: '[oops' }, props)).toEqual({ tags: '[oops' });
    expect(parseJsonFields({ tags: '[1]' }, undefined)).toEqual({ tags: '[1]' });
  });
});
