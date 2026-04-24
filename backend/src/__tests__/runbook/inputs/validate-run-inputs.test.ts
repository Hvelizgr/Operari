import { validateRunInputs } from '../../../runbook/inputs/validate-run-inputs';
import type { RunbookInputDefinition } from '../../../types/workflow.types';

describe('validateRunInputs', () => {
  it('passes the payload through when no inputs are declared', () => {
    const result = validateRunInputs([], { anything: 'goes' });
    expect(result).toEqual({ ok: true, values: { anything: 'goes' } });
  });

  it('passes through on null/undefined definitions too', () => {
    expect(validateRunInputs(null, { x: 1 })).toEqual({ ok: true, values: { x: 1 } });
    expect(validateRunInputs(undefined, { x: 1 })).toEqual({ ok: true, values: { x: 1 } });
  });

  it('returns an empty values map when neither definitions nor payload exist', () => {
    expect(validateRunInputs([], null)).toEqual({ ok: true, values: {} });
    expect(validateRunInputs([], undefined)).toEqual({ ok: true, values: {} });
  });

  it('accepts a well-formed text input', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'env', type: 'text', required: true }];
    const result = validateRunInputs(defs, { env: 'prod' });
    expect(result).toEqual({ ok: true, values: { env: 'prod' } });
  });

  it('coerces stringified numbers into numbers (form payload shape)', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'n', type: 'number', required: true }];
    const result = validateRunInputs(defs, { n: '42' });
    expect(result).toEqual({ ok: true, values: { n: 42 } });
  });

  it('accepts a native number for number type', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'n', type: 'number' }];
    const result = validateRunInputs(defs, { n: 7 });
    expect(result).toEqual({ ok: true, values: { n: 7 } });
  });

  it('rejects a non-numeric string for number type', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'n', type: 'number' }];
    const result = validateRunInputs(defs, { n: 'abc' });
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'n', message: 'n must be a number' }],
    });
  });

  it('rejects NaN/Infinity for number type', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'n', type: 'number' }];
    expect(validateRunInputs(defs, { n: NaN })).toMatchObject({ ok: false });
    expect(validateRunInputs(defs, { n: Infinity })).toMatchObject({ ok: false });
  });

  it('coerces "true"/"false" strings to booleans', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'dry', type: 'boolean' }];
    expect(validateRunInputs(defs, { dry: 'true' })).toEqual({ ok: true, values: { dry: true } });
    expect(validateRunInputs(defs, { dry: 'false' })).toEqual({ ok: true, values: { dry: false } });
  });

  it('accepts native booleans', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'dry', type: 'boolean' }];
    expect(validateRunInputs(defs, { dry: true })).toEqual({ ok: true, values: { dry: true } });
  });

  it('rejects other strings as booleans', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'dry', type: 'boolean' }];
    const result = validateRunInputs(defs, { dry: 'yes' });
    expect(result).toMatchObject({ ok: false });
  });

  it('accepts a select value from the allowed options', () => {
    const defs: RunbookInputDefinition[] = [
      { name: 'env', type: 'select', options: ['dev', 'prod'] },
    ];
    const result = validateRunInputs(defs, { env: 'prod' });
    expect(result).toEqual({ ok: true, values: { env: 'prod' } });
  });

  it('rejects a select value outside the allowed options', () => {
    const defs: RunbookInputDefinition[] = [
      { name: 'env', type: 'select', options: ['dev', 'prod'] },
    ];
    const result = validateRunInputs(defs, { env: 'staging' });
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'env', message: 'env must be one of: dev, prod' }],
    });
  });

  it('flags missing required inputs', () => {
    const defs: RunbookInputDefinition[] = [
      { name: 'env', type: 'text', required: true },
      { name: 'who', type: 'text', required: true },
    ];
    const result = validateRunInputs(defs, { env: 'prod' });
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'who', message: 'who is required' }],
    });
  });

  it('treats empty-string as missing (forms send empty rather than omitting)', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'env', type: 'text', required: true }];
    const result = validateRunInputs(defs, { env: '' });
    expect(result).toMatchObject({ ok: false });
  });

  it('applies the declared default when an optional input is missing', () => {
    const defs: RunbookInputDefinition[] = [
      { name: 'env', type: 'text', default: 'dev' },
      { name: 'retries', type: 'number', default: 3 },
    ];
    const result = validateRunInputs(defs, {});
    expect(result).toEqual({ ok: true, values: { env: 'dev', retries: 3 } });
  });

  it('omits missing optionals without defaults (no undefined leakage)', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'reason', type: 'text' }];
    const result = validateRunInputs(defs, {});
    expect(result).toEqual({ ok: true, values: {} });
  });

  it('rejects unknown keys as typos', () => {
    const defs: RunbookInputDefinition[] = [{ name: 'env', type: 'text' }];
    const result = validateRunInputs(defs, { env: 'prod', enivronment: 'stg' });
    expect(result).toEqual({
      ok: false,
      issues: [{ field: 'enivronment', message: 'unknown input "enivronment"' }],
    });
  });

  it('accumulates multiple issues in a single pass', () => {
    const defs: RunbookInputDefinition[] = [
      { name: 'env', type: 'text', required: true },
      { name: 'n', type: 'number', required: true },
      { name: 'pick', type: 'select', options: ['a', 'b'] },
    ];
    const result = validateRunInputs(defs, { n: 'nope', pick: 'c', extra: 1 });
    if (result.ok) throw new Error('expected invalid');
    const fields = result.issues.map(i => i.field).sort();
    expect(fields).toEqual(['env', 'extra', 'n', 'pick']);
  });

  it('coerces a native number to text when the declared type is text', () => {
    // Forms can submit a number-typed field. Text declarations tolerate
    // that without erroring so the engine gets a deterministic string.
    const defs: RunbookInputDefinition[] = [{ name: 'label', type: 'text' }];
    const result = validateRunInputs(defs, { label: 42 });
    expect(result).toEqual({ ok: true, values: { label: '42' } });
  });
});
