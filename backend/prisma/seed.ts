
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_ACCOUNTS = [
    {
        tenantSlug: 'student-tenant',
        tenantName: 'Student Tenant',
        plan: 'FREE' as const,
        email: 'student@nanoflow.dev',
        password: 'student123',
        name: 'Student User'
    },
    {
        tenantSlug: 'teacher-tenant',
        tenantName: 'Education Tenant',
        plan: 'PRO' as const,
        email: 'teacher@nanoflow.dev',
        password: 'teacher123',
        name: 'Teacher User'
    },
    {
        tenantSlug: 'agency-tenant',
        tenantName: 'Agency Tenant',
        plan: 'GROWTH' as const,
        email: 'agency@nanoflow.dev',
        password: 'agency123',
        name: 'Agency User'
    }
];

async function main() {
    console.log('Seeding database...');

    let tenant = await prisma.tenant.findUnique({ where: { slug: 'default-tenant' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Default Tenant',
                slug: 'default-tenant',
                plan: 'FREE',
            },
        });
    }
    console.log(`Tenant ready: ${tenant.id}`);

    let user = await prisma.user.findUnique({ where: { email: 'anonymous@nanoflow.local' } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email: 'anonymous@nanoflow.local',
                passwordHash: 'nopassword',
                name: 'Anonymous User',
                role: 'USER',
                tenantId: tenant.id,
            },
        });
    }
    console.log(`User ready: ${user.id}`);

    console.log('Creating test accounts for development...');
    for (const account of TEST_ACCOUNTS) {
        const testTenant = await prisma.tenant.upsert({
            where: { slug: account.tenantSlug },
            update: { plan: account.plan },
            create: {
                name: account.tenantName,
                slug: account.tenantSlug,
                plan: account.plan,
            },
        });

        const passwordHash = await bcrypt.hash(account.password, 10);
        await prisma.user.upsert({
            where: { email: account.email },
            update: { 
                passwordHash,
                tenantId: testTenant.id,
                emailVerified: true
            },
            create: {
                email: account.email,
                passwordHash,
                name: account.name,
                role: 'ADMIN',
                tenantId: testTenant.id,
                emailVerified: true,
            },
        });
        console.log(`Created test account: ${account.email} (${account.plan})`);
    }

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

    // Seed Templates
    const { WORKFLOW_TEMPLATES } = require('../src/data/templates');
    console.log(`Seeding ${WORKFLOW_TEMPLATES.length} templates...`);

    for (const t of WORKFLOW_TEMPLATES) {
        await (prisma as any).template.upsert({
            where: { id: t.id },
            update: {
                name: t.name,
                description: t.description,
                nodes: t.nodes,
                connections: t.connections,
                category: t.category,
                isPublic: true
            },
            create: {
                id: t.id,
                name: t.name,
                description: t.description,
                nodes: t.nodes,
                connections: t.connections,
                category: t.category,
                isPublic: true
            }
        });
    }
    console.log('Templates seeded successfully');
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
