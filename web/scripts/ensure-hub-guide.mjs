import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const title = "Getting the best out of WYE Tech Hub";
const fileName = "Getting the best out of WYE Tech Hub.docx";
const filePath = path.join("content", fileName);

const db = process.env.DATABASE_URL || "";
if (!db.startsWith("postgres") || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.log("Skipping hub guide seed (database or blob storage is not configured).");
  process.exit(0);
}
if (!fs.existsSync(filePath)) {
  console.log("Skipping hub guide seed (Word file is missing).");
  process.exit(0);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: db }),
});

const org = await prisma.organization.findUnique({ where: { slug: "webb-yates" } });
if (!org) {
  console.log("Skipping hub guide seed (organisation not found).");
  await prisma.$disconnect();
  process.exit(0);
}

const existing = await prisma.guide.findFirst({
  where: { organizationId: org.id, title },
});
if (existing) {
  console.log("Hub guide already in the library.");
  await prisma.$disconnect();
  process.exit(0);
}

const bytes = fs.readFileSync(filePath);
const blob = await put(`tech-hub/${org.slug}/guides/${fileName}`, bytes, {
  access: "public",
  token: process.env.BLOB_READ_WRITE_TOKEN,
  contentType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  addRandomSuffix: true,
});

const user = await prisma.user.findFirst({
  where: { memberships: { some: { organizationId: org.id } } },
  orderBy: { createdAt: "asc" },
});

await prisma.guide.create({
  data: {
    organizationId: org.id,
    title,
    summary:
      "How the pages fit together, how to use each one, and how the pyRevit tab feeds the same hub without leaving the model.",
    category: "How to",
    keywords:
      "overview, how to, projects, weekly board, calendar, families, details, technical issues, guides, pyrevit, revit",
    fileName,
    fileMimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sharePointItemId: blob.pathname,
    sharePointWebUrl: blob.url,
    createdById: user?.id || null,
  },
});

console.log("Added the Tech Hub how-to guide.");
await prisma.$disconnect();
