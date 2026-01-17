
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const node = await prisma.nodeType.findFirst({
        where: { type: { contains: 'Code', mode: 'insensitive' } }
    });
    console.log('Code node:', node);
}
main().catch(console.error).finally(() => prisma.$disconnect());
