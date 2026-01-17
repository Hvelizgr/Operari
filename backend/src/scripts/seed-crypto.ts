
// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nanoflow?schema=public'
        }
    }
});

async function main() {
    console.log('🌱 Seeding Crypto Price Tracker Workflow...');

    const tenantId = 'default-tenant';
    const userId = 'anonymous';

    // Ensure user/tenant (idempotent)
    await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: { id: tenantId, name: 'Default', slug: 'default', plan: 'FREE' }
    });
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId, email: 'anon@local', name: 'Anon', role: 'USER', tenantId, passwordHash: 'dummy' }
    });

    const nodes = [
        {
            id: 'node-start',
            type: 'Schedule',
            title: 'Every 5 Minutes',
            position: { x: 100, y: 300 },
            config: { cron: '*/5 * * * *' },
            outputs: [{ id: 'out-1', label: 'trigger' }]
        },
        {
            id: 'node-http',
            type: 'HTTP',
            title: 'Get Bitcoin Price',
            position: { x: 400, y: 300 },
            config: {
                url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
                method: 'GET'
            },
            inputs: [{ id: 'in-1', label: 'input' }],
            outputs: [{ id: 'out-1', label: 'json' }]
        },
        {
            id: 'node-if',
            type: 'Condition',
            title: 'Price > $90k?',
            position: { x: 750, y: 300 },
            config: {
                field: 'bitcoin.usd',
                operator: 'greaterThan',
                value: '90000'
            },
            inputs: [{ id: 'in-1', label: 'input' }],
            outputs: [
                { id: 'true', label: 'True' },
                { id: 'false', label: 'False' }
            ]
        },
        {
            id: 'node-alert',
            type: 'Action',
            title: 'Alert: TO THE MOON! 🚀',
            position: { x: 1100, y: 200 },
            config: {
                actionType: 'email',
                emailSubject: 'BTC Alert',
                emailBody: 'Bitcoin is passing $90k!'
            },
            inputs: [{ id: 'in-1', label: 'input' }]
        },
        {
            id: 'node-log',
            type: 'Action',
            title: 'Log: Hodl...',
            position: { x: 1100, y: 450 },
            config: {
                actionType: 'channel', // console log
                channelTargets: ['console']
            },
            inputs: [{ id: 'in-1', label: 'input' }]
        }
    ];

    const connections = [
        { id: 'c1', source: 'node-start', target: 'node-http' },
        { id: 'c2', source: 'node-http', target: 'node-if' },
        { id: 'c3', source: 'node-if', target: 'node-alert', sourcePort: 0 }, // True path
        { id: 'c4', source: 'node-if', target: 'node-log', sourcePort: 1 }    // False path
    ];

    // Delete old one
    try { await prisma.workflow.delete({ where: { id: 'current-workflow' } }); } catch { }

    // Create new one
    await prisma.workflow.create({
        data: {
            id: 'current-workflow',
            name: 'Bitcoin Price Tracker 🚀',
            description: 'Check BTC price and alert if high.',
            nodes: nodes as any,
            connections: connections as any,
            isActive: true,
            userId,
            tenantId,
            updatedAt: new Date(Date.now() + 1000 * 60) // Future timestamp to force overwrite if possible?
        }
    });

    console.log('✅ Crypto Workflow Seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
