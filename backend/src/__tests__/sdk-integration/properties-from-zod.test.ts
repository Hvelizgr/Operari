/**
 * Round-trip every supported zod shape through propertiesFromZod and
 * pin the resulting PluginStepProperty[] shape so the editor's
 * DynamicNodeForm renders the expected widget for each field.
 *
 * Lives in the backend test tree because:
 *   - The SDK has no test runner of its own (test = "echo no tests yet").
 *   - The backend already has zod in dependencies.
 *   - The integration boundary that matters — "what an author writes
 *     should produce what the editor renders" — straddles the SDK and
 *     the editor's Property[] contract anyway.
 */

import { z } from 'zod';

interface PluginStepProperty {
  name: string;
  displayName: string;
  type: 'string' | 'boolean' | 'options' | 'number' | 'secret' | 'sql' | 'color';
  default?: unknown;
  description?: string;
  options?: { name: string; value: string }[];
  typeOptions?: { rows?: number; expression?: boolean; provider?: string };
}

interface PropertiesFromZodFn {
  (schema: unknown): PluginStepProperty[];
}

const { propertiesFromZod } =
  require('../../../../packages/sdk/dist/steps/properties-from-zod') as {
    propertiesFromZod: PropertiesFromZodFn;
  };

describe('propertiesFromZod', () => {
  it('returns [] for non-object inputs (null, primitives, plain objects)', () => {
    expect(propertiesFromZod(null)).toEqual([]);
    expect(propertiesFromZod('string')).toEqual([]);
    expect(propertiesFromZod({})).toEqual([]);
    expect(propertiesFromZod(z.string())).toEqual([]);
  });

  it('maps ZodString → string with humanized displayName', () => {
    const schema = z.object({
      webhookUrl: z.string(),
      simple: z.string(),
    });
    const out = propertiesFromZod(schema);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      name: 'webhookUrl',
      displayName: 'Webhook url',
      type: 'string',
    });
    expect(out[1]).toMatchObject({ name: 'simple', displayName: 'Simple', type: 'string' });
  });

  it('maps ZodNumber → number and ZodBoolean → boolean', () => {
    const schema = z.object({
      timeout: z.number(),
      verbose: z.boolean(),
    });
    const out = propertiesFromZod(schema);
    expect(out.find(p => p.name === 'timeout')!.type).toBe('number');
    expect(out.find(p => p.name === 'verbose')!.type).toBe('boolean');
  });

  it('maps ZodEnum → options with one choice per enum value', () => {
    const schema = z.object({
      severity: z.enum(['info', 'warning', 'error']),
    });
    const [prop] = propertiesFromZod(schema);
    expect(prop.type).toBe('options');
    expect(prop.options).toEqual([
      { name: 'info', value: 'info' },
      { name: 'warning', value: 'warning' },
      { name: 'error', value: 'error' },
    ]);
  });

  it('maps a single string ZodLiteral → options with one choice', () => {
    const schema = z.object({
      kind: z.literal('webhook'),
    });
    const [prop] = propertiesFromZod(schema);
    expect(prop.type).toBe('options');
    expect(prop.options).toEqual([{ name: 'webhook', value: 'webhook' }]);
  });

  it('maps a string-valued ZodNativeEnum → options', () => {
    enum Kind {
      Slack = 'slack',
      Discord = 'discord',
    }
    const schema = z.object({
      channel: z.nativeEnum(Kind),
    });
    const [prop] = propertiesFromZod(schema);
    expect(prop.type).toBe('options');
    // Native enums emit one entry per key. Both keys + values are
    // strings so both pairs round-trip.
    expect(prop.options?.map(o => o.value).sort()).toEqual(['discord', 'slack']);
  });

  it('reads .describe() into the property description', () => {
    const schema = z.object({
      name: z.string().describe('Name to greet'),
    });
    const [prop] = propertiesFromZod(schema);
    expect(prop.description).toBe('Name to greet');
  });

  it('unwraps .optional() and .nullable() and surfaces the inner description', () => {
    const schema = z.object({
      maybeName: z.string().describe('Optional name').optional(),
      maybeAge: z.number().nullable().describe('Outer nullable description'),
    });
    const out = propertiesFromZod(schema);
    expect(out.find(p => p.name === 'maybeName')).toMatchObject({
      type: 'string',
      description: 'Optional name',
    });
    expect(out.find(p => p.name === 'maybeAge')).toMatchObject({
      type: 'number',
      description: 'Outer nullable description',
    });
  });

  it('captures .default(value) on the property', () => {
    const schema = z.object({
      verbose: z.boolean().default(false),
      tag: z.string().default('latest'),
      retries: z.number().default(3),
    });
    const out = propertiesFromZod(schema);
    expect(out.find(p => p.name === 'verbose')?.default).toBe(false);
    expect(out.find(p => p.name === 'tag')?.default).toBe('latest');
    expect(out.find(p => p.name === 'retries')?.default).toBe(3);
  });

  it('unwraps .refine() / .transform() (ZodEffects) to the underlying primitive', () => {
    const schema = z.object({
      url: z.string().refine(v => v.startsWith('http')),
      lower: z.string().transform(v => v.toLowerCase()),
    });
    const out = propertiesFromZod(schema);
    expect(out.find(p => p.name === 'url')?.type).toBe('string');
    expect(out.find(p => p.name === 'lower')?.type).toBe('string');
  });

  it('drops fields whose zod type has no corresponding renderer (ZodArray, ZodRecord)', () => {
    const schema = z.object({
      tags: z.array(z.string()),
      meta: z.record(z.string()),
      keep: z.string(),
    });
    const out = propertiesFromZod(schema);
    expect(out.map(p => p.name)).toEqual(['keep']);
  });

  it('round-trips a realistic plugin schema end-to-end', () => {
    const schema = z.object({
      webhookUrl: z.string().url().describe('Slack webhook URL'),
      message: z.string().describe('Message body'),
      severity: z.enum(['info', 'warning', 'error']).default('info'),
      verbose: z.boolean().default(false).describe('Include the full payload'),
      timeoutMs: z.number().default(30000),
    });

    const out = propertiesFromZod(schema);

    expect(out).toHaveLength(5);
    expect(out.map(p => p.name)).toEqual([
      'webhookUrl',
      'message',
      'severity',
      'verbose',
      'timeoutMs',
    ]);
    const severity = out.find(p => p.name === 'severity')!;
    expect(severity.type).toBe('options');
    expect(severity.default).toBe('info');
    const verbose = out.find(p => p.name === 'verbose')!;
    expect(verbose.type).toBe('boolean');
    expect(verbose.default).toBe(false);
    expect(verbose.description).toBe('Include the full payload');
  });
});
