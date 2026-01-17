
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    const tenant = await prisma.tenant.upsert({
        where: { slug: 'default-tenant' },
        update: {},
        create: {
            id: 'default-tenant',
            name: 'Default Tenant',
            slug: 'default-tenant',
            plan: 'FREE',
        },
    });
    console.log(`Created tenant: ${tenant.id}`);

    const user = await prisma.user.upsert({
        where: { email: 'anonymous@nanoflow.local' },
        update: {
            tenantId: tenant.id
        },
        create: {
            id: 'anonymous',
            email: 'anonymous@nanoflow.local',
            passwordHash: 'nopassword',
            name: 'Anonymous User',
            role: 'USER',
            tenantId: tenant.id,
        },
    });
    console.log(`Created user: ${user.id}`);

    // Create a default workflow for testing if none exists
    const wfCount = await prisma.workflow.count();
    if (wfCount === 0) {
        await prisma.workflow.create({
            data: {
                name: 'My First Workflow',
                nodes: [],
                connections: [],
                userId: user.id,
                tenantId: tenant.id
            }
        });
        console.log('Created default workflow');
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
