const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({});

async function main() {
  const setsCount = await prisma.set.count();
  console.log('Sets count:', setsCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
