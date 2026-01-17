
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nanoflow?schema=public'
        }
    }
});

async function main() {
    console.log('🌱 Seeding current-workflow...');

    // 1. Ensure Tenant exists
    const tenantId = 'default-tenant';
    await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: {
            id: tenantId,
            name: 'Default Tenant',
            slug: 'default',
            plan: 'FREE'
        }
    });

    // 2. Ensure User exists
    const userId = 'anonymous';
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            email: 'anonymous@nanoflow.local',
            name: 'Anonymous User',
            passwordHash: 'dummy',
            tenantId: tenantId,
            role: 'USER'
        }
    });

    // 3. Define the "Real & Easy" Workflow
    // A nice flow: Manual Trigger -> HTTP Request (Chuck Norris Joke) -> Transform (Extract Joke)
    const nodes = [
        {
            id: 'node-1',
            type: 'Trigger',
            title: 'Manual Start',
            position: { x: 100, y: 100 },
            config: {},
            inputs: [],
            outputs: [{ id: 'out-1', label: 'trigger' }]
        },
        {
            id: 'node-2',
            type: 'HTTP',
            title: 'Get Random Joke',
            position: { x: 400, y: 100 },
            config: {
                url: 'https://api.chucknorris.io/jokes/random',
                method: 'GET'
            },
            inputs: [{ id: 'in-1', label: 'input' }],
            outputs: [{ id: 'out-1', label: 'json' }]
        },
        {
            id: 'node-3',
            type: 'Transform',
            title: 'Extract Joke',
            position: { x: 700, y: 100 },
            config: {
                code: 'return { joke: input.value };'
            },
            inputs: [{ id: 'in-1', label: 'json' }],
            outputs: [{ id: 'out-1', label: 'result' }]
        }
    ];

    const connections = [
        {
            id: 'conn-1',
            source: 'node-1',
            target: 'node-2',
            sourcePort: 0,
            targetPort: 0
        },
        {
            id: 'conn-2',
            source: 'node-2',
            target: 'node-3',
            sourcePort: 0,
            targetPort: 0
        }
    ];

    // 4. Delete existing if any
    try {
        await prisma.workflow.delete({ where: { id: 'current-workflow' } });
        console.log('   - Deleted old current-workflow');
    } catch (e) {
        // ignore if not found
    }

    // 5. Create new
    await prisma.workflow.create({
        data: {
            id: 'current-workflow',
            name: 'Chuck Norris Joke Flow',
            description: 'A simple flow to fetch a joke from an API.',
            nodes: nodes as any,
            connections: connections as any,
            isActive: true,
            userId: userId,
            tenantId: tenantId
        }
    });

    console.log('✅ Workflow "current-workflow" seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
