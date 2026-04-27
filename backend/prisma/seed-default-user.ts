import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'default-tenant' },
    update: {},
    create: {
      id: 'default-tenant',
      name: 'Default Tenant',
      slug: 'default',
      plan: 'FREE',
    },
  });

  console.log('✓ Default tenant created:', tenant.id);

  // Create anonymous user
  const user = await prisma.user.upsert({
    where: { id: 'anonymous' },
    update: {},
    create: {
      id: 'anonymous',
      email: 'anonymous@operari.local',
      name: 'Anonymous User',
      passwordHash: 'not-used',
      role: 'USER',
      tenantId: tenant.id,
    },
  });

  console.log('✓ Anonymous user created:', user.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
