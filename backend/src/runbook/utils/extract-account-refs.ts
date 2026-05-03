import { SecretTemplateResolver } from '../secrets/secret-template-resolver';

/**
 * Walks a step config and returns every connected-account id it
 * references. Two channels feed the result:
 *
 *   1. `{{secrets.<id>}}` templates (anywhere in the config tree) —
 *      handled by `SecretTemplateResolver.extractRefs`, which is the
 *      canonical scanner used at run time. Reusing it keeps the
 *      "what counts as a reference" rule in one place.
 *   2. Well-known credential field names that hold a raw account id
 *      as a string — e.g. github / database / ssh executors all read
 *      `config.credentialId`, kubectl reads `config.kubeconfigSecret`.
 *      These never wrap themselves in `{{secrets.…}}` because they're
 *      consumed by the engine's secret pre-resolver, not by template
 *      interpolation in user fields.
 *
 * The cross-environment edge marker (Tier C) needs both. A `database`
 * step that wires `credentialId: "acc-prod-pg"` would otherwise look
 * accountless to the scanner even though it clearly targets prod.
 */

const KNOWN_ACCOUNT_FIELDS: readonly string[] = [
  'credentialId',
  'accountId',
  'connectedAccountId',
  'kubeconfigSecret',
  'sshCredentialId',
] as const;

const looksLikeAccountId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64;

const collectKnownFields = (value: unknown, sink: Set<string>): void => {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectKnownFields(item, sink);
    return;
  }
  if (typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  for (const [key, v] of Object.entries(obj)) {
    if (KNOWN_ACCOUNT_FIELDS.includes(key) && looksLikeAccountId(v)) {
      sink.add(v);
    } else {
      collectKnownFields(v, sink);
    }
  }
};

export function extractAccountRefs(config: unknown): string[] {
  const found = new Set<string>(SecretTemplateResolver.extractRefs(config));
  collectKnownFields(config, found);
  return [...found];
}
