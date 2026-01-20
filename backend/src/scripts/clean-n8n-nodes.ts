
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up local n8n node definitions from database...');
  
  const { count } = await prisma.nodeType.deleteMany({
    where: { 
      type: { startsWith: 'n8n-nodes-base.' } 
    }
  });

  console.log(`✅ Successfully deleted ${count} imported n8n nodes.`);
  console.log('NanoFlow will now fetch these definitions dynamically from the n8n API.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
