import { z } from 'zod';

import { logger } from '../../config/logger.config';
import {
  type RunbookInputDefinition,
  runbookInputDefinitionSchema,
} from '../../types/workflow.types';

/**
 * Parse a `Runbook.inputs` JSON blob coming out of Prisma into a
 * typed `RunbookInputDefinition[]`.
 *
 * Why this exists: Prisma's `Json` column is typed as `unknown`, so
 * every call site that wanted to feed the definitions into the
 * run-input validator had to fall back to an
 * `as unknown as RunbookInputDefinition[]` cast. That cast loses
 * runtime safety — if a row ever ended up with a malformed blob
 * (hand-edited DB, legacy migration, stale snapshot), the validator
 * would iterate over garbage and produce cryptic errors instead of
 * a single log line identifying the bad row.
 *
 * Behavior on malformed JSON: log once at error level and fall back
 * to an empty array. An empty-input runbook is the safest default —
 * it preserves pre-typed-inputs behavior while the operator fixes
 * the row. Throwing would break every dispatch for a single bad row
 * in a tenant.
 *
 * Null/undefined → empty array (the common case for runbooks that
 * never opted into typed inputs).
 */
export function parseInputDefs(value: unknown): RunbookInputDefinition[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    logger.error(
      { typeofValue: typeof value },
      'parseInputDefs: Runbook.inputs is not an array, treating as empty'
    );
    return [];
  }
  const parsed = z.array(runbookInputDefinitionSchema).safeParse(value);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.issues },
      'parseInputDefs: Runbook.inputs failed schema validation, treating as empty'
    );
    return [];
  }
  return parsed.data;
}
