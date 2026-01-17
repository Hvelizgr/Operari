
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const types = ['n8n-nodes-base.ManualTrigger', 'n8n-nodes-base.HttpRequest', 'n8n-nodes-base.Code'];
    for (const t of types) {
        const node = await prisma.nodeType.findUnique({ where: { type: t } });
        console.log(`Node ${t}:`, node ? 'EXISTS' : 'MISSING');
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
