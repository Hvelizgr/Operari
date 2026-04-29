import canonical from '../../../backend/src/runbook/yaml/runbook.schema.json';
import { FALLBACK_SCHEMA } from '@/utils/runbookSchemaValidator';

/**
 * Drift guard for the inline fallback copy of the JSON Schema.
 *
 * The frontend prefers the live schema served by the backend at
 * `/runbook.schema.json`, but falls back to a bundled copy when the
 * backend is unreachable (offline dev, very early page load before
 * the API is up). The bundled copy is hand-maintained — there is no
 * build step that copies the canonical file across the workspace
 * boundary — so it can silently drift out of sync. When that
 * happens, an offline editor session validates against an obsolete
 * shape, accepts a runbook the backend would later reject, and the
 * operator sees a "your change broke" error from the API.
 *
 * This test makes that drift fail the build instead. If the
 * canonical schema changes, the fix is one of:
 *   - copy the new shape into FALLBACK_SCHEMA verbatim, OR
 *   - if the offline path no longer needs that shape (e.g. removed
 *     a step config field) leave the fallback narrower and update
 *     this test's assertion.
 */
describe('FALLBACK_SCHEMA', () => {
  it('matches the canonical backend/runbook/yaml/runbook.schema.json byte-for-byte', () => {
    expect(FALLBACK_SCHEMA).toEqual(canonical);
  });
});
