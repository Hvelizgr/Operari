
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const count = await prisma.nodeType.count();
    console.log('Node types count:', count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
