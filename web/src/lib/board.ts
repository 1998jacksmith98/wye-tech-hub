import { prisma } from "@/lib/prisma";

export const DEFAULT_BOARD_COLUMNS = [
  "In the Pipeline / on Hold",
  "Not started",
  "Assigned / started",
  "Out for checking",
  "Complete",
] as const;

export async function ensureBoardColumns(organizationId: string) {
  const existing = await prisma.boardColumn.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
  });

  if (existing.length === 0) {
    await prisma.boardColumn.createMany({
      data: DEFAULT_BOARD_COLUMNS.map((name, position) => ({
        organizationId,
        name,
        position,
      })),
    });
  }

  const columns = await prisma.boardColumn.findMany({
    where: { organizationId },
    orderBy: { position: "asc" },
  });

  const defaultColumnId = columns[0]?.id;
  if (defaultColumnId) {
    await prisma.project.updateMany({
      where: {
        organizationId,
        status: "Active",
        boardColumnId: null,
      },
      data: { boardColumnId: defaultColumnId },
    });
  }

  return columns;
}

export function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
