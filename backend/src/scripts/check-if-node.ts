
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const nodes = await prisma.nodeType.findMany({
        where: { type: { contains: 'if', mode: 'insensitive' } }
    });
    console.log('IF nodes:', nodes.map(n => n.type));
}
main().catch(console.error).finally(() => prisma.$disconnect());