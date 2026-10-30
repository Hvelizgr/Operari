import {
  ConnectedAccountError,
  ConnectedAccountService,
} from '../../security/connected-account.service';

/**
 * SecretTemplateResolver — pre-resolves `{{secrets.<id>}}` references
 * in a step config before the executor runs.
 *
 * Why pre-resolution (not lazy lookups inside `resolveTemplate`):
 *   - The template engine stays sync, so executors that pass plain
 *     strings to libraries (`fetch`, `child_process.spawn`, ...) do not
 *     need to thread Promises through every interpolation site.
 *   - One audit event per unique secret per step instead of one per
 *     substitution site — auditors care about "which secret was read
 *     for run R, step S", not how many `${{ }}` placeholders the user
 *     happened to type.
 *   - The step fails fast with a clear error before any traffic goes
 *     out, so a typo in a secret id never produces an HTTP request
 *     with an empty bearer header.
 *
 * Tenant safety: every fetch goes through ConnectedAccountService,
 * which refuses cross-tenant reads. The runbook engine passes its own
 * tenantId, never one taken from the step config.
 */

const SECRET_REF_PATTERN = /\{\{\s*secrets\.([A-Za-z0-9_-]+)/g;
const BARE_ID = /^[A-Za-z0-9_-]+$/;

export interface ResolveSecretsInput {
  /** Step config — walked recursively for `{{secrets.<id>}}` references. */
  config: unknown;
  /** Tenant the run belongs to. Authoritative — never trusts the config. */
  tenantId: string;
  /** Run id — surfaces in the audit `actorId` so dashboards can group by run. */
  runId: string;
  /** Step id — surfaces in the audit `reason` so the link is unambiguous. */
  stepId: string;
}

export class SecretReferenceError extends Error {
  constructor(
    message: string,
    public readonly accountId: string,
    public readonly stepId: string
  ) {
    super(message);
    this.name = 'SecretReferenceError';
  }
}

export class SecretTemplateResolver {
  constructor(private readonly accounts: ConnectedAccountService) {}

  /**
   * Walk `value` recursively and return every distinct connected
   * account id referenced via `{{secrets.<id>}}`. Order is stable
   * (insertion order of first appearance) so test fixtures stay
   * deterministic.
   */
  static extractRefs(value: unknown): string[] {
    const found = new Set<string>();
    SecretTemplateResolver.walk(value, found);
    return [...found];
  }

  private static walk(value: unknown, sink: Set<string>): void {
    if (value == null) return;
    if (typeof value === 'string') {
      // The regex is global; reset lastIndex defensively because
      // a previous partial iteration could leave it non-zero.
      SECRET_REF_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SECRET_REF_PATTERN.exec(value)) !== null) {
        sink.add(match[1]);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) SecretTemplateResolver.walk(item, sink);
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        // Hand-written YAML may name a credential by bare id; executors
        // accept that (see credentialSecret), so it must be fetched too.
        if (/credentialId$/i.test(k) && typeof v === 'string' && BARE_ID.test(v.trim())) {
          sink.add(v.trim());
          continue;
        }
        SecretTemplateResolver.walk(v, sink);
      }
    }
  }

  /**
   * Pre-resolve every `{{secrets.<id>}}` reference in the supplied
   * config and return a plaintext map ready to drop into
   * `ExecutorContext.secrets`. Fails fast on the first missing or
   * cross-tenant id with a `SecretReferenceError`; the caller turns
   * that into a step failure so no partial credentials ever leak
   * into the executor.
   */
  async resolve(input: ResolveSecretsInput): Promise<Record<string, string>> {
    const refs = SecretTemplateResolver.extractRefs(input.config);
    if (refs.length === 0) return {};

    const out: Record<string, string> = {};
    for (const accountId of refs) {
      try {
        out[accountId] = await this.accounts.getAccessToken({
          accountId,
          tenantId: input.tenantId,
          actorType: 'system',
          actorId: `run:${input.runId}`,
          reason: `runbook-step:${input.stepId}`,
        });
      } catch (err) {
        if (err instanceof ConnectedAccountError) {
          const reason =
            err.code === 'NOT_FOUND'
              ? `connected account "${accountId}" does not exist`
              : err.code === 'CROSS_TENANT'
                ? `connected account "${accountId}" belongs to another tenant`
                : err.message;
          throw new SecretReferenceError(
            `Cannot resolve {{secrets.${accountId}}} for step "${input.stepId}": ${reason}`,
            accountId,
            input.stepId
          );
        }
        throw err;
      }
    }
    return out;
  }
}
