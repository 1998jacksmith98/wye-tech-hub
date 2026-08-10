"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";

async function ownedProject(projectId: string, organizationId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId },
  });
}

export async function ensureProjectDeadlines(projectId: string) {
  const existing = await prisma.projectDeadline.count({ where: { projectId } });
  if (existing > 0) return;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;

  const toCreate: { label: string; date: string; sortOrder: number }[] = [];
  if (project.startDate) {
    toCreate.push({ label: "Start", date: project.startDate, sortOrder: 0 });
  }
  if (project.nextIssueDate) {
    toCreate.push({
      label: "Next issue",
      date: project.nextIssueDate,
      sortOrder: toCreate.length,
    });
  }
  if (toCreate.length === 0) return;

  await prisma.projectDeadline.createMany({
    data: toCreate.map((d) => ({ projectId, ...d })),
  });
}

export async function addProjectDeadline(projectId: string, formData: FormData) {
  const session = await requireSession();
  const project = await ownedProject(projectId, session.user.organizationId!);
  if (!project) throw new Error("Project not found");

  const label = String(formData.get("label") || "").trim() || "Deadline";
  const date = String(formData.get("date") || "").trim();
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);

  const max = await prisma.projectDeadline.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  const deadline = await prisma.projectDeadline.create({
    data: {
      projectId,
      label,
      date,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      assignments: {
        create: userIds.map((userId) => ({ userId })),
      },
    },
  });

  // Keep legacy nextIssueDate in sync with earliest upcoming-looking issue label
  if (/issue/i.test(label) && date) {
    await prisma.project.update({
      where: { id: projectId },
      data: { nextIssueDate: date },
    });
  }
  if (/start/i.test(label) && date) {
    await prisma.project.update({
      where: { id: projectId },
      data: { startDate: date },
    });
  }

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId,
    userId: session.user.id,
    action: "added deadline",
    detail: `${label} ${date}`.trim(),
  });

  revalidatePath("/app/weekly");
  revalidatePath("/app/calendar");
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
  return deadline.id;
}

export async function updateProjectDeadline(
  deadlineId: string,
  formData: FormData,
) {
  const session = await requireSession();
  const deadline = await prisma.projectDeadline.findUnique({
    where: { id: deadlineId },
    include: { project: true },
  });
  if (
    !deadline ||
    deadline.project.organizationId !== session.user.organizationId
  ) {
    throw new Error("Deadline not found");
  }

  const label = String(formData.get("label") || "").trim() || deadline.label;
  const date = String(formData.get("date") || "").trim();
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);

  await prisma.projectDeadline.update({
    where: { id: deadlineId },
    data: {
      label,
      date,
      assignments: {
        deleteMany: {},
        create: userIds.map((userId) => ({ userId })),
      },
    },
  });

  if (/issue/i.test(label)) {
    await prisma.project.update({
      where: { id: deadline.projectId },
      data: { nextIssueDate: date },
    });
  }
  if (/start/i.test(label)) {
    await prisma.project.update({
      where: { id: deadline.projectId },
      data: { startDate: date },
    });
  }

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: deadline.projectId,
    userId: session.user.id,
    action: "updated deadline",
    detail: `${label} ${date}`.trim(),
  });

  revalidatePath("/app/weekly");
  revalidatePath("/app/calendar");
  revalidatePath(`/app/projects/${deadline.projectId}`);
  revalidatePath("/app");
}

export async function deleteProjectDeadline(deadlineId: string) {
  const session = await requireSession();
  const deadline = await prisma.projectDeadline.findUnique({
    where: { id: deadlineId },
    include: { project: true },
  });
  if (
    !deadline ||
    deadline.project.organizationId !== session.user.organizationId
  ) {
    throw new Error("Deadline not found");
  }

  await prisma.projectDeadline.delete({ where: { id: deadlineId } });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: deadline.projectId,
    userId: session.user.id,
    action: "removed deadline",
    detail: deadline.label,
  });

  revalidatePath("/app/weekly");
  revalidatePath("/app/calendar");
  revalidatePath(`/app/projects/${deadline.projectId}`);
  revalidatePath("/app");
}
