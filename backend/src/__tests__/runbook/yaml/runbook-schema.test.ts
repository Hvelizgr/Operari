import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import runbookJsonSchema from '../../../runbook/yaml/runbook.schema.json';

/**
 * Two contracts pinned by this file:
 *
 *   1. The hand-written runbook.schema.json (which the editor, the
 *      CLI, and VS Code via yaml.schemas all consume) actually
 *      describes the RunbookSpec the serializer produces.
 *
 *   2. Every YAML in templates/ is a valid runbook against that
 *      schema. If a template drifts past the schema we want jest red,
 *      not a confused user opening an issue.
 *
 * Drift between runbook-spec.ts (the TypeScript source of truth) and
 * runbook.schema.json (the JSON Schema source of truth) is the price
 * of hand-writing the schema instead of generating it. The matrix
 * test below catches the most common drift modes — required fields,
 * enum values, and the shape of `next` — without pulling a code-gen
 * step into the build.
 */

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(runbookJsonSchema);

const TEMPLATES_DIR = join(__dirname, '../../../../../templates');

function loadYaml(file: string): unknown {
  return yaml.load(readFileSync(file, 'utf-8'));
}

describe('runbook.schema.json', () => {
  describe('shape contract', () => {
    it('compiles as a valid JSON Schema', () => {
      // Ajv.compile throws on a malformed schema; reaching this
      // line means the schema itself is well-formed.
      expect(typeof validate).toBe('function');
    });

    it('rejects an empty object', () => {
      const ok = validate({});
      expect(ok).toBe(false);
    });

    it('accepts the minimal valid runbook', () => {
      const ok = validate({
        version: 1,
        name: 'minimal',
        steps: [{ id: 'only', type: 'shell' }],
      });
      expect(ok).toBe(true);
    });

    it('rejects version != 1', () => {
      const ok = validate({
        version: 2,
        name: 'x',
        steps: [{ id: 'a', type: 'shell' }],
      });
      expect(ok).toBe(false);
    });

    it('rejects step ids with uppercase letters', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [{ id: 'BadCase', type: 'shell' }],
      });
      expect(ok).toBe(false);
    });

    it('rejects an empty steps array', () => {
      const ok = validate({ version: 1, name: 'x', steps: [] });
      expect(ok).toBe(false);
    });

    it('accepts retry policy with all fields', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'a',
            type: 'shell',
            retry: { count: 3, backoff: 'exponential', delayMs: 1000, maxDelayMs: 30000 },
          },
        ],
      });
      expect(ok).toBe(true);
    });

    it('rejects retry with backoff outside the enum', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [{ id: 'a', type: 'shell', retry: { count: 1, backoff: 'linear' } }],
      });
      expect(ok).toBe(false);
    });

    it('accepts next as a bare string', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [
          { id: 'a', type: 'shell', next: 'b' },
          { id: 'b', type: 'shell' },
        ],
      });
      expect(ok).toBe(true);
    });

    it('accepts next as an array of strings', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [
          { id: 'a', type: 'shell', next: ['b', 'c'] },
          { id: 'b', type: 'shell' },
          { id: 'c', type: 'shell' },
        ],
      });
      expect(ok).toBe(true);
    });

    it('accepts next as an array of structured StepConnection', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'a',
            type: 'switch',
            next: [
              { to: 'b', fromPort: 0 },
              { to: 'c', fromPort: 1 },
            ],
          },
          { id: 'b', type: 'shell' },
          { id: 'c', type: 'shell' },
        ],
      });
      expect(ok).toBe(true);
    });

    it('rejects unknown top-level fields', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [{ id: 'a', type: 'shell' }],
        weirdField: true,
      });
      expect(ok).toBe(false);
    });

    it('rejects unknown step fields', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [{ id: 'a', type: 'shell', weirdField: true }],
      });
      expect(ok).toBe(false);
    });

    it('accepts runIf and skipIf as strings', () => {
      const ok = validate({
        version: 1,
        name: 'x',
        steps: [
          {
            id: 'a',
            type: 'shell',
            runIf: '{{vars.environment}} == "prod"',
            skipIf: '{{vars.dryRun}}',
          },
        ],
      });
      expect(ok).toBe(true);
    });
  });

  describe('templates/ matrix', () => {
    const files = readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => ({ name: f, path: join(TEMPLATES_DIR, f) }));

    it('finds at least one template', () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it.each(files)('$name validates against the runbook schema', ({ path }) => {
      const parsed = loadYaml(path);
      const ok = validate(parsed);
      if (!ok) {
        // Surface ajv errors with the template name so the
        // failing field is obvious.
        const errors = (validate.errors ?? []).map(
          e => `  ${e.instancePath || '<root>'}: ${e.message}`
        );
        throw new Error(
          `${path} does not validate against runbook.schema.json:\n${errors.join('\n')}`
        );
      }
    });
  });
});
