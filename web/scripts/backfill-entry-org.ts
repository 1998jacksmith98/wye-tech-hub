import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$executeRawUnsafe(`
    UPDATE Entry
    SET organizationId = (
      SELECT organizationId FROM Project WHERE Project.id = Entry.projectId
    )
    WHERE organizationId IS NULL AND projectId IS NOT NULL
  `);
  console.log("Backfilled entries:", rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
