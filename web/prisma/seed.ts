import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { ORG_NAME, ORG_SLUG } from "../src/lib/constants";
import { DEFAULT_BOARD_COLUMNS } from "../src/lib/board";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: ORG_NAME },
    create: { name: ORG_NAME, slug: ORG_SLUG },
  });

  const existing = await prisma.boardColumn.count({
    where: { organizationId: org.id },
  });

  if (existing === 0) {
    await prisma.boardColumn.createMany({
      data: DEFAULT_BOARD_COLUMNS.map((name, position) => ({
        organizationId: org.id,
        name,
        position,
      })),
    });
  }

  console.log(`Seeded organization: ${ORG_NAME}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
