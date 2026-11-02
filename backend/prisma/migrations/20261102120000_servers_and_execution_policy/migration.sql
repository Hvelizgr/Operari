-- Execution policy on the tenant
ALTER TABLE "Tenant" ADD COLUMN "sshPolicy" TEXT NOT NULL DEFAULT 'registered';
ALTER TABLE "Tenant" ADD COLUMN "sandboxEgress" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Tenant" ADD COLUMN "egressAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Tenant" ADD COLUMN "privilegedApprovals" INTEGER NOT NULL DEFAULT 1;

-- Registered servers
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL,
    "hostKey" TEXT NOT NULL,
    "hostKeyFingerprint" TEXT NOT NULL,
    "authMode" TEXT NOT NULL DEFAULT 'key',
    "credentialId" TEXT,
    "sudoAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Server_tenantId_name_key" ON "Server"("tenantId", "name");
CREATE INDEX "Server_tenantId_idx" ON "Server"("tenantId");
ALTER TABLE "Server" ADD CONSTRAINT "Server_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workspace SSH certificate authority
CREATE TABLE "SshCertificateAuthority" (
    "tenantId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SshCertificateAuthority_pkey" PRIMARY KEY ("tenantId")
);
ALTER TABLE "SshCertificateAuthority" ADD CONSTRAINT "SshCertificateAuthority_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
