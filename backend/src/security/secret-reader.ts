import { SecretCipher, SecretCipherError } from './secret-cipher';
import type { AuditService, ActorType } from '../audit/audit.service';

/**
 * SecretReader — the only sanctioned way to read decrypted secrets in
 * NanoRun production code.
 *
 * Wraps {@link SecretCipher} so that every successful or failed decrypt
 * emits a `secret.accessed` audit event tied to the requesting actor.
 * Consumers (e.g. ConnectedAccountService when it ships) MUST go through
 * `SecretReader.read()` rather than calling `SecretCipher.decrypt()`
 * directly. The cipher itself stays a pure crypto primitive with no
 * dependency on the audit chain.
 *
 * Why bother emitting on failure too: a sudden burst of failed
 * `secret.accessed` events is the cheapest detector for "wrong key
 * after rotation" or "someone is replaying ciphertext from a backup".
 * The chain stores success/failure plus the cipher key fingerprint so
 * the operator can correlate against `key.rotated` events later.
 *
 * See `docs/audit-event-coverage.md` for the rationale and the full
 * coverage matrix.
 */

export interface SecretReadRequest {
  /** Encrypted blob produced by `SecretCipher.encrypt` */
  ciphertext: string;
  /** Optional AAD bound to the ciphertext (e.g. user id, account id) */
  aad?: string;
  /**
   * Tenant whose audit chain receives the event. Required — there is
   * no "global" audit log in NanoRun.
   */
  tenantId: string;
  /** Who is asking. `null` for system-initiated reads (cron, runner). */
  actorId?: string | null;
  actorType?: ActorType | null;
  /**
   * Resource the secret belongs to (e.g. `connected-account:abc123`).
   * Surfaced in the audit row for filtering, never the secret itself.
   */
  resource: string;
  /**
   * Free-form reason recorded in the payload. Examples: `"oauth-refresh"`,
   * `"runbook-step"`, `"connection-test"`. Used by the dashboard to
   * group secret accesses by purpose.
   */
  reason: string;
}

export class SecretReader {
  constructor(
    private readonly cipher: SecretCipher,
    private readonly audit: AuditService
  ) {}

  /**
   * Decrypt and audit. Throws the original {@link SecretCipherError}
   * after the failure event has been recorded — callers see the same
   * exception they would get from `SecretCipher.decrypt`.
   */
  async read(request: SecretReadRequest): Promise<string> {
    const startedAt = Date.now();
    let plaintext: string;
    try {
      plaintext = this.cipher.decrypt(request.ciphertext, request.aad);
    } catch (err) {
      await this.recordSafe({
        request,
        success: false,
        durationMs: Date.now() - startedAt,
        error: err instanceof SecretCipherError ? err.message : 'decrypt failed',
      });
      throw err;
    }

    await this.recordSafe({
      request,
      success: true,
      durationMs: Date.now() - startedAt,
    });
    return plaintext;
  }

  /**
   * Audit write that swallows its own errors. The point of the audit
   * chain is to be best-effort observability — we never want a flaky
   * Postgres write to break a runbook that legitimately needs the
   * secret. The chain verifier (`nanorun audit verify`) is the
   * backstop for "did we miss anything".
   */
  private async recordSafe(args: {
    request: SecretReadRequest;
    success: boolean;
    durationMs: number;
    error?: string;
  }): Promise<void> {
    try {
      await this.audit.record({
        tenantId: args.request.tenantId,
        type: 'secret.accessed',
        actorId: args.request.actorId ?? null,
        actorType: args.request.actorType ?? 'system',
        resource: args.request.resource,
        payload: {
          success: args.success,
          reason: args.request.reason,
          durationMs: args.durationMs,
          keyFingerprint: this.cipher.keyFingerprint(),
          ...(args.error ? { error: args.error } : {}),
        },
      });
    } catch {
      // intentional: see method comment
    }
  }
}
