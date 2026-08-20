import { prisma } from "@/lib/prisma";
import { ensureBoardColumns } from "@/lib/board";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { ORG_SLUG } from "@/lib/constants";
import { hubBaseUrl, type RevitActor } from "@/lib/revit-auth";

export function extractJobNumber(raw: string) {
  const text = (raw || "").trim().toUpperCase();
  const match = text.match(/J\d{3,6}/);
  return match ? match[0] : text;
}

export async function findProjectByJobNumber(
  organizationId: string,
  rawJobNumber: string,
) {
  const job = extractJobNumber(rawJobNumber);
  if (!job) return null;

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      jobNumber: { contains: job },
    },
    include: {
      boardColumn: true,
      assignments: { include: { user: true } },
      checklist: {
        include: { assignedTo: true },
        orderBy: [{ isComplete: "asc" }, { createdAt: "desc" }],
      },
      deadlines: { orderBy: { sortOrder: "asc" } },
    },
  });

  const exact = projects.filter(
    (p) => extractJobNumber(p.jobNumber) === job,
  );
  const pool = exact.length ? exact : projects;
  if (!pool.length) return null;

  return (
    pool.find((p) => p.status === "Active") ||
    pool.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]
  );
}

export function serializeJob(
  project: NonNullable<Awaited<ReturnType<typeof findProjectByJobNumber>>>,
) {
  const openChecklist = project.checklist.filter((c) => !c.isComplete);
  return {
    id: project.id,
    jobNumber: project.jobNumber,
    jobName: project.jobName,
    status: project.status,
    leadEngineer: project.leadEngineer,
    nextIssueDate: project.nextIssueDate,
    boardColumnId: project.boardColumnId,
    boardColumnName: project.boardColumn?.name || "Unassigned",
    hubUrl: `${hubBaseUrl()}/app/projects/${project.id}`,
    assignees: project.assignments.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
    })),
    deadlines: project.deadlines.map((d) => ({
      id: d.id,
      label: d.label,
      date: d.date,
    })),
    openChecklistCount: openChecklist.length,
    checklist: project.checklist.map((item) => ({
      id: item.id,
      text: item.text,
      isComplete: item.isComplete,
      assignedTo: item.assignedTo
        ? { id: item.assignedTo.id, name: item.assignedTo.name }
        : null,
    })),
  };
}

export async function moveJobColumn(
  actor: RevitActor,
  projectId: string,
  columnId: string,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
    include: { boardColumn: true },
  });
  if (!project) throw new Error("Project not found");

  const column = await prisma.boardColumn.findFirst({
    where: { id: columnId, organizationId: actor.organizationId },
  });
  if (!column) throw new Error("Column not found");

  const siblings = await prisma.project.findMany({
    where: {
      organizationId: actor.organizationId,
      boardColumnId: columnId,
      id: { not: projectId },
      status: "Active",
    },
    orderBy: { boardOrder: "asc" },
  });

  const ordered = [...siblings];
  ordered.splice(0, 0, project);

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

  await logActivity({
    organizationId: actor.organizationId,
    projectId,
    userId: actor.userId,
    action: "moved board column",
    detail: `${project.boardColumn?.name || "Unassigned"} → ${column.name}`,
  });

  return column.name;
}

export async function addJobChecklistItem(
  actor: RevitActor,
  projectId: string,
  text: string,
) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Action item required");

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
  });
  if (!project) throw new Error("Project not found");

  const item = await prisma.checklistItem.create({
    data: {
      projectId,
      text: trimmed,
      createdById: actor.userId,
    },
  });

  await logActivity({
    organizationId: actor.organizationId,
    projectId,
    userId: actor.userId,
    action: "added action item",
    detail: trimmed.slice(0, 60),
  });

  return item;
}

export async function toggleJobChecklistItem(
  actor: RevitActor,
  itemId: string,
  isComplete: boolean,
) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { project: true },
  });
  if (!item || item.project.organizationId !== actor.organizationId) {
    throw new Error("Item not found");
  }

  await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      isComplete,
      completedById: isComplete ? actor.userId : null,
      completedAt: isComplete ? new Date() : null,
    },
  });

  await logActivity({
    organizationId: actor.organizationId,
    projectId: item.projectId,
    userId: actor.userId,
    action: isComplete ? "completed action" : "reopened action",
    detail: item.text.slice(0, 60),
  });
}

type EntryInput = {
  contentType?: string;
  textContent?: string;
  linkUrl?: string;
  source?: string;
  topic?: string;
  status?: string;
  person?: string;
  screenshotBase64?: string;
  screenshotFileName?: string;
  viewName?: string;
};

export async function addJobEntry(
  actor: RevitActor,
  projectId: string,
  input: EntryInput,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: actor.organizationId },
    include: { organization: true },
  });
  if (!project) throw new Error("Project not found");

  const contentType = (input.contentType || "Note").trim() || "Note";
  let textContent = (input.textContent || "").trim();
  const linkUrl = (input.linkUrl || "").trim();
  const viewName = (input.viewName || "").trim();
  if (viewName) {
    const stamp = `[Revit · ${project.jobNumber} · ${viewName}]`;
    textContent = textContent ? `${stamp}\n${textContent}` : stamp;
  }

  const tags: Record<string, string> = {};
  if (input.source && input.source !== "—") tags.source = input.source;
  if (input.topic && input.topic !== "—") tags.topic = input.topic;
  if (input.status && input.status !== "—") tags.status = input.status;
  if (input.person) tags.person = input.person.trim();
  if (!tags.source) tags.source = "Revit";

  let fileMeta: {
    fileName?: string;
    fileMimeType?: string;
    sharePointItemId?: string;
    sharePointWebUrl?: string;
    localFilePath?: string;
  } = {};
  const b64 = (input.screenshotBase64 || "").replace(/\s/g, "");
  if (b64) {
    const bytes = Buffer.from(b64, "base64");
    fileMeta = await storeUpload({
      userId: actor.userId,
      orgSlug: project.organization.slug || ORG_SLUG,
      projectNumber: project.jobNumber,
      fileName: input.screenshotFileName || "revit-capture.png",
      mimeType: "image/png",
      bytes,
    });
  }

  if (!textContent && !fileMeta.fileName && !linkUrl) {
    throw new Error("Add text, a screenshot, or a link.");
  }

  const entry = await prisma.entry.create({
    data: {
      organizationId: actor.organizationId,
      projectId,
      contentType: fileMeta.fileName ? "Screenshot" : contentType,
      textContent,
      linkUrl,
      tagsJson: JSON.stringify(tags),
      createdById: actor.userId,
      fileName: fileMeta.fileName,
      fileMimeType: fileMeta.fileMimeType,
      sharePointItemId: fileMeta.sharePointItemId,
      sharePointWebUrl: fileMeta.sharePointWebUrl,
      localFilePath: fileMeta.localFilePath,
    },
  });

  await logActivity({
    organizationId: actor.organizationId,
    projectId,
    userId: actor.userId,
    action: `added ${entry.contentType}`,
    detail: textContent.slice(0, 60) || fileMeta.fileName || linkUrl,
  });

  return entry;
}

export async function listBoardColumns(organizationId: string) {
  const columns = await ensureBoardColumns(organizationId);
  return columns.map((c) => ({ id: c.id, name: c.name, position: c.position }));
}
