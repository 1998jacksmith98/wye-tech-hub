"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { TIMELINE_STAGES } from "@/lib/constants";
import { ensureBoardColumns } from "@/lib/board";

function revalidateBoardViews() {
  revalidatePath("/app/weekly");
  revalidatePath("/app/calendar");
  revalidatePath("/app");
}

export async function moveProjectOnBoard(
  projectId: string,
  columnId: string,
  newIndex: number,
) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
  });
  if (!project) throw new Error("Project not found");

  const column = await prisma.boardColumn.findFirst({
    where: { id: columnId, organizationId: orgId },
  });
  if (!column) throw new Error("Column not found");

  const siblings = await prisma.project.findMany({
    where: {
      organizationId: orgId,
      boardColumnId: columnId,
      id: { not: projectId },
      status: "Active",
    },
    orderBy: { boardOrder: "asc" },
  });

  const ordered = [...siblings];
  const clamped = Math.max(0, Math.min(newIndex, ordered.length));
  ordered.splice(clamped, 0, project);

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { boardColumnId: columnId },
    }),
    ...ordered.map((p, index) =>
      prisma.project.update({
        where: { id: p.id },
        data: { boardOrder: index },
      }),
    ),
  ]);

  revalidateBoardViews();
}

export async function createBoardTile(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;
  const columns = await ensureBoardColumns(orgId);

  const columnId = String(formData.get("columnId") || "").trim() || columns[0]?.id;
  const jobNumber = String(formData.get("jobNumber") || "").trim();
  const jobName = String(formData.get("jobName") || "").trim();
  const nextIssueDate = String(formData.get("nextIssueDate") || "").trim();

  if (!columnId || !jobNumber || !jobName) {
    throw new Error("Job number and name are required.");
  }

  const maxOrder = await prisma.project.aggregate({
    where: { boardColumnId: columnId },
    _max: { boardOrder: true },
  });

  const project = await prisma.project.create({
    data: {
      organizationId: orgId,
      createdById: session.user.id,
      jobNumber,
      jobName,
      nextIssueDate,
      status: "Active",
      boardColumnId: columnId,
      boardOrder: (maxOrder._max.boardOrder ?? -1) + 1,
      milestones: {
        create: TIMELINE_STAGES.map((stage) => ({ stage })),
      },
      ...(nextIssueDate
        ? {
            deadlines: {
              create: [{ label: "Next issue", date: nextIssueDate, sortOrder: 0 }],
            },
          }
        : {}),
    },
  });

  await logActivity({
    organizationId: orgId,
    projectId: project.id,
    userId: session.user.id,
    action: "created board tile",
    detail: project.jobName,
  });

  revalidateBoardViews();
}

export async function renameBoardColumn(columnId: string, name: string) {
  const session = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name required");

  const column = await prisma.boardColumn.findFirst({
    where: { id: columnId, organizationId: session.user.organizationId! },
  });
  if (!column) throw new Error("Column not found");

  await prisma.boardColumn.update({
    where: { id: columnId },
    data: { name: trimmed },
  });

  revalidateBoardViews();
}

export async function createBoardColumn(name: string) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name required");

  await ensureBoardColumns(orgId);

  const maxPos = await prisma.boardColumn.aggregate({
    where: { organizationId: orgId },
    _max: { position: true },
  });

  await prisma.boardColumn.create({
    data: {
      organizationId: orgId,
      name: trimmed,
      position: (maxPos._max.position ?? -1) + 1,
    },
  });

  revalidateBoardViews();
}

export async function deleteBoardColumn(columnId: string) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const columns = await prisma.boardColumn.findMany({
    where: { organizationId: orgId },
    orderBy: { position: "asc" },
  });

  if (columns.length <= 1) {
    throw new Error("You need at least one column on the board.");
  }

  const column = columns.find((c) => c.id === columnId);
  if (!column) throw new Error("Column not found");

  const fallback = columns.find((c) => c.id !== columnId)!;

  const maxOrder = await prisma.project.aggregate({
    where: { boardColumnId: fallback.id },
    _max: { boardOrder: true },
  });

  const cards = await prisma.project.findMany({
    where: { boardColumnId: columnId },
    orderBy: { boardOrder: "asc" },
  });

  await prisma.$transaction([
    ...cards.map((card, index) =>
      prisma.project.update({
        where: { id: card.id },
        data: {
          boardColumnId: fallback.id,
          boardOrder: (maxOrder._max.boardOrder ?? -1) + 1 + index,
        },
      }),
    ),
    prisma.boardColumn.delete({ where: { id: columnId } }),
  ]);

  revalidateBoardViews();
}
