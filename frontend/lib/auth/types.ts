export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  /**
   * True once the user clicked the link in the verification email.
   * OAuth users land true because the IdP pre-verified. Missing in
   * legacy session payloads (undefined) — treat missing as false.
   */
  emailVerified?: boolean;
  /**
   * True when TOTP two-factor is armed on the account. Drives the
   * login step-up prompt and the Security panel "disable" flow.
   */
  mfaEnabled?: boolean;
  /**
   * Count of unused MFA backup codes. Present only when mfaEnabled
   * is true. The Security panel nudges regeneration when low.
   */
  backupCodesRemaining?: number;
}

export interface AuthTenant {
  id: string;
  name: string;
  plan?: string;
}

export interface AuthSession {
  user: AuthUser;
  tenant: AuthTenant;
}

export interface AuthErrorBody {
  error: string | Array<{ path: (string | number)[]; message: string }>;
}
