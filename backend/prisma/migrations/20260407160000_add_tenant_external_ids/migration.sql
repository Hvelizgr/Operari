-- Tenant external identity / billing identifiers (P1 #11 + #12)
--
-- Adds two nullable columns to Tenant so cloud deployments can link
-- a tenant to its WorkOS organization (for SSO) and its Stripe
-- customer (for usage-based billing). Both are NULL on self-host;
-- the corresponding adapter (WorkOSAuthProvider, StripeBillingMeter)
-- treats NULL as "feature not configured for this tenant" and
-- fails closed.
--
-- Both are UNIQUE: one tenant per WorkOS org, one tenant per Stripe
-- customer. The unique index doubles as the lookup index for the
-- adapter queries — no need for an additional non-unique index.
--
-- Backwards compatible: existing rows get NULL for both columns,
-- which matches the self-host default.

ALTER TABLE "Tenant" ADD COLUMN "workosOrganizationId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX "Tenant_workosOrganizationId_key"
    ON "Tenant" ("workosOrganizationId");
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key"
    ON "Tenant" ("stripeCustomerId");
