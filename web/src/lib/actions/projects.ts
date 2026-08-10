"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { TIMELINE_STAGES } from "@/lib/constants";
import { ensureBoardColumns } from "@/lib/board";

const projectSchema = z.object({
  jobNumber: z.string().min(1),
  jobName: z.string().min(1),
  status: z.enum(["Active", "Archived"]).default("Active"),
  leadTechnicianId: z.string().optional().nullable(),
  leadEngineer: z.string().optional().default(""),
  client: z.string().optional().default(""),
  architect: z.string().optional().default(""),
  architectSoftware: z.string().optional().default(""),
  revitVersion: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  nextIssueDate: z.string().optional().default(""),
});

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createProject(formData: FormData) {
  const session = await requireSession();
  const parsed = projectSchema.parse({
    jobNumber: formString(formData, "jobNumber"),
    jobName: formString(formData, "jobName"),
    status: formString(formData, "status") || "Active",
    leadTechnicianId: formString(formData, "leadTechnicianId") || null,
    leadEngineer: formString(formData, "leadEngineer"),
    client: formString(formData, "client"),
    architect: formString(formData, "architect"),
    architectSoftware: formString(formData, "architectSoftware"),
    revitVersion: formString(formData, "revitVersion"),
    startDate: formString(formData, "startDate"),
    nextIssueDate: formString(formData, "nextIssueDate"),
  });

  const columns = await ensureBoardColumns(session.user.organizationId!);
  const columnId = formString(formData, "boardColumnId") || columns[0]?.id || null;
  const maxOrder = columnId
    ? await prisma.project.aggregate({
        where: { boardColumnId: columnId },
        _max: { boardOrder: true },
      })
    : null;

  const project = await prisma.project.create({
    data: {
      organizationId: session.user.organizationId!,
      createdById: session.user.id,
      ...parsed,
      leadTechnicianId: parsed.leadTechnicianId || null,
      boardColumnId: columnId,
      boardOrder: (maxOrder?._max.boardOrder ?? -1) + 1,
      milestones: {
        create: TIMELINE_STAGES.map((stage) => ({ stage })),
      },
    },
  });

  revalidatePath("/app/weekly");

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: project.id,
    userId: session.user.id,
    action: "created project",
    detail: project.jobName,
  });

  revalidatePath("/app");
  redirect(`/app/projects/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await requireSession();
  const existing = await prisma.project.findFirst({
    where: { id: projectId, organizationId: session.user.organizationId! },
  });
  if (!existing) throw new Error("Project not found");

  const parsed = projectSchema.parse({
    jobNumber: formString(formData, "jobNumber"),
    jobName: formString(formData, "jobName"),
    status: formString(formData, "status") || "Active",
    leadTechnicianId: formString(formData, "leadTechnicianId") || null,
    leadEngineer: formString(formData, "leadEngineer"),
    client: formString(formData, "client"),
    architect: formString(formData, "architect"),
    architectSoftware: formString(formData, "architectSoftware"),
    revitVersion: formString(formData, "revitVersion"),
    startDate: formString(formData, "startDate"),
    nextIssueDate: formString(formData, "nextIssueDate"),
  });

  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...parsed,
      leadTechnicianId: parsed.leadTechnicianId || null,
    },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId,
    userId: session.user.id,
    action: "updated project info",
    detail: parsed.jobName,
  });

  revalidatePath("/app");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function setProjectAssignments(projectId: string, userIds: string[]) {
  const session = await requireSession();
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: session.user.organizationId! },
    include: { assignments: true },
  });
  if (!project) throw new Error("Project not found");

  const oldIds = new Set(project.assignments.map((a) => a.userId));
  const nextIds = new Set(userIds);

  await prisma.$transaction([
    prisma.projectAssignment.deleteMany({ where: { projectId } }),
    ...userIds.map((userId) =>
      prisma.projectAssignment.create({
        data: { projectId, userId },
      }),
    ),
  ]);

  for (const id of userIds) {
    if (!oldIds.has(id)) {
      const user = await prisma.user.findUnique({ where: { id } });
      await logActivity({
        organizationId: session.user.organizationId!,
        projectId,
        userId: id,
        action: `joined ${project.jobName}`,
        detail: user?.name || "",
      });
    }
  }
  for (const id of oldIds) {
    if (!nextIds.has(id)) {
      await logActivity({
        organizationId: session.user.organizationId!,
        projectId,
        userId: id,
        action: `left ${project.jobName}`,
      });
    }
  }

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
  revalidatePath("/app/weekly");
}

export async function updateMilestone(
  milestoneId: string,
  formData: FormData,
) {
  const session = await requireSession();
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { project: true },
  });
  if (
    !milestone ||
    milestone.project.organizationId !== session.user.organizationId
  ) {
    throw new Error("Milestone not found");
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      targetDate: formString(formData, "targetDate"),
      confirmedDate: formString(formData, "confirmedDate"),
      notes: formString(formData, "notes"),
      isReached: formData.get("isReached") === "on" || formData.get("isReached") === "true",
      updatedById: session.user.id,
    },
  });

  await prisma.project.update({
    where: { id: milestone.projectId },
    data: { updatedAt: new Date() },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: milestone.projectId,
    userId: session.user.id,
    action: "updated timeline",
    detail: milestone.stage,
  });

  revalidatePath(`/app/projects/${milestone.projectId}`);
}

export async function addChecklistItem(projectId: string, formData: FormData) {
  const session = await requireSession();
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: session.user.organizationId! },
  });
  if (!project) throw new Error("Project not found");

  const text = formString(formData, "text");
  if (!text) throw new Error("Action item required");
  const assignedToId = formString(formData, "assignedToId") || null;

  await prisma.checklistItem.create({
    data: {
      projectId,
      text,
      assignedToId,
      createdById: session.user.id,
    },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId,
    userId: session.user.id,
    action: "added action item",
    detail: text.slice(0, 60),
  });

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
}

export async function toggleChecklistItem(itemId: string, isComplete: boolean) {
  const session = await requireSession();
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { project: true },
  });
  if (!item || item.project.organizationId !== session.user.organizationId) {
    throw new Error("Item not found");
  }

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      isComplete,
      completedById: isComplete ? session.user.id : null,
      completedAt: isComplete ? new Date() : null,
    },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: item.projectId,
    userId: session.user.id,
    action: isComplete ? "completed action" : "reopened action",
    detail: item.text.slice(0, 60),
  });

  revalidatePath(`/app/projects/${item.projectId}`);
  revalidatePath("/app");
}

export async function updateChecklistItem(itemId: string, formData: FormData) {
  const session = await requireSession();
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { project: true },
  });
  if (!item || item.project.organizationId !== session.user.organizationId) {
    throw new Error("Item not found");
  }

  const text = formString(formData, "text");
  if (!text) throw new Error("Action item required");
  const assignedToId = formString(formData, "assignedToId") || null;

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: { text, assignedToId },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: item.projectId,
    userId: session.user.id,
    action: "updated action item",
    detail: text.slice(0, 60),
  });

  revalidatePath(`/app/projects/${item.projectId}`);
  revalidatePath("/app");
}

export async function deleteChecklistItem(itemId: string) {
  const session = await requireSession();
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { project: true },
  });
  if (!item || item.project.organizationId !== session.user.organizationId) {
    throw new Error("Item not found");
  }
  await prisma.checklistItem.delete({ where: { id: itemId } });
  revalidatePath(`/app/projects/${item.projectId}`);
}
