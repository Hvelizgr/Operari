-- Tenant-wide "everyone must enroll TOTP" policy. Drives the
-- `mfaEnrollmentRequired` flag the login handler returns; the UI
-- bounces affected users straight to /settings/security so they
-- can enroll before anything else renders.
--
-- Default is false so existing tenants keep behaving exactly the
-- same until an admin explicitly turns the policy on.

ALTER TABLE "Tenant"
    ADD COLUMN "mfaRequired" BOOLEAN NOT NULL DEFAULT false;
