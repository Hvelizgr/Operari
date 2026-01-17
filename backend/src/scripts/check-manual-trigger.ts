
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const node = await prisma.nodeType.findFirst({
        where: { type: { contains: 'ManualTrigger', mode: 'insensitive' } }
    });
    console.log('ManualTrigger node:', node);
}
main().catch(console.error).finally(() => prisma.$disconnect());
