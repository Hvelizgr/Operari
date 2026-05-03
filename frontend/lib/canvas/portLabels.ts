/**
 * Single source of truth for "what output ports does THIS step have,
 * given its current config?" — pure helper shared by:
 *
 *   - `BaseStepNode` (renders one Handle per port)
 *   - `runbookYaml.expandNext` (maps `next: { label: target }` to the
 *     right `fromPort` index)
 *   - `runbookYaml.simplifyNext` (round-trips back to label-keyed
 *     form when serializing)
 *
 * The catalog's static `outputs` array is the right answer for most
 * step types (shell, http, notify, …). For step types whose port
 * count + labels are *operator-defined* — currently only `Switch` —
 * we have to walk the step config to compute them, otherwise edges
 * connecting to operator-defined branches end up referencing a
 * source handle that doesn't exist in the DOM.
 */

/**
 * Catalog defaults per step type. Any type not listed here uses
 * its catalog `outputs` field directly.
 *
 * `Switch`: catalog defaults to ['case_1', 'case_2', 'default'] but
 * those are SEED values for a freshly-dragged node — once the
 * operator (or a YAML template) configures real cases, the labels
 * become whatever the YAML / form provides.
 */

interface SwitchCase {
  /** Display label shown next to the handle. Falls back to `value`. */
  label?: string;
  /** Match value the engine compares against the field. */
  value?: string;
}

/**
 * Read `cases` out of the Switch step's config, regardless of whether
 * it arrived as an array (parsed YAML) or a JSON string (the form
 * field is currently typed as `string`). Returns the user-visible
 * port labels in order, ALWAYS appending `default` as the last port
 * so a Switch is never zero-output.
 */
export function deriveSwitchOutputs(config: unknown): string[] {
  let cases: SwitchCase[] = [];
  if (config && typeof config === 'object') {
    const raw = (config as { cases?: unknown }).cases;
    if (Array.isArray(raw)) {
      cases = raw as SwitchCase[];
    } else if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cases = parsed as SwitchCase[];
      } catch {
        // Form field can be mid-edit — fall through to no cases.
      }
    }
  }
  const labels = cases
    .map(c => (c && typeof c === 'object' ? (c.label ?? c.value ?? null) : null))
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
  // Empty config → keep the editor functional with the seed labels.
  if (labels.length === 0) return ['case_1', 'case_2', 'default'];
  return [...labels, 'default'];
}

/**
 * Static port labels per multi-output step type — used by both the
 * parser (to map label → fromPort) and the serializer (to map
 * fromPort → label on round-trip).
 *
 * `Switch` is intentionally absent here because its labels are
 * dynamic; callers must call `deriveSwitchOutputs` instead.
 */
export const STATIC_BRANCH_OUTPUTS: Record<string, string[]> = {
  approval: ['approved', 'rejected'],
  'operari.if': ['true', 'false'],
  Condition: ['true', 'false'],
};

/**
 * Resolve the output labels for a step at parse / serialize time.
 * `defaultOutputs` is the catalog's static value (e.g. ['main']) used
 * when the step has no special handling.
 */
export function resolveStepOutputs(
  stepType: string | undefined,
  config: unknown,
  defaultOutputs: string[]
): string[] {
  if (!stepType) return defaultOutputs;
  if (stepType === 'Switch') return deriveSwitchOutputs(config);
  return STATIC_BRANCH_OUTPUTS[stepType] ?? defaultOutputs;
}
