import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureBoardColumns } from "@/lib/board";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { ORG_SLUG } from "@/lib/constants";
import { hubBaseUrl, type RevitActor } from "@/lib/revit-auth";
import { syncLibraryFeedEntry } from "@/lib/library-feed";

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

type LibraryInput = {
  name?: string;
  description?: string;
  category?: string;
  materials?: string;
  keywords?: string;
  filePath?: string;
  revitVersion?: string;
  drawnIn?: string;
  status?: string;
  workaround?: string;
  linkToJob?: boolean;
  screenshotBase64?: string;
  screenshotFileName?: string;
};

async function uploadLibraryScreenshot(
  actor: RevitActor,
  orgSlug: string,
  folder: string,
  input: LibraryInput,
) {
  const b64 = (input.screenshotBase64 || "").replace(/\s/g, "");
  if (!b64) return null;
  return storeUpload({
    userId: actor.userId,
    orgSlug: orgSlug || ORG_SLUG,
    projectNumber: folder,
    fileName: input.screenshotFileName || "revit-capture.png",
    mimeType: "image/png",
    bytes: Buffer.from(b64, "base64"),
  });
}

export async function addRevitFamily(
  actor: RevitActor,
  project: { id: string; jobNumber: string; jobName: string },
  input: LibraryInput,
) {
  const name = (input.name || "").trim();
  const filePath = (input.filePath || "").trim();
  if (!name) throw new Error("Family name is required.");
  if (!filePath) throw new Error("Paste the network path to the .rfa file.");

  const orgSlug = actor.organizationSlug || ORG_SLUG;
  const linked = input.linkToJob !== false;
  const family = await prisma.family.create({
    data: {
      organizationId: actor.organizationId,
      name,
      description: (input.description || "").trim(),
      category: (input.category || "Other").trim() || "Other",
      materials: (input.materials || "").trim(),
      keywords: (input.keywords || "").trim(),
      filePath,
      projectId: linked ? project.id : null,
      jobNumber: linked ? project.jobNumber : "",
      jobName: linked ? project.jobName : "",
      revitVersion: (input.revitVersion || "").trim(),
      createdById: actor.userId,
    },
  });

  const uploaded = await uploadLibraryScreenshot(
    actor,
    orgSlug,
    `families/${family.id}`,
    input,
  );
  if (uploaded) {
    await prisma.familyImage.create({
      data: {
        familyId: family.id,
        fileName: uploaded.fileName,
        fileMimeType: uploaded.fileMimeType,
        sharePointItemId: uploaded.sharePointItemId,
        sharePointWebUrl: uploaded.sharePointWebUrl,
        localFilePath: uploaded.localFilePath,
        sortOrder: 0,
      },
    });
  }

  await syncLibraryFeedEntry({
    organizationId: actor.organizationId,
    userId: actor.userId,
    kind: "family",
    libraryId: family.id,
    projectId: linked ? project.id : null,
    name: family.name,
    description: family.description,
    category: family.category,
    filePath: family.filePath,
    image: uploaded,
  });

  await logActivity({
    organizationId: actor.organizationId,
    projectId: linked ? project.id : null,
    userId: actor.userId,
    action: "added family",
    detail: name,
  });

  revalidatePath("/app/families");
  revalidatePath("/app");

  return family;
}

export async function addRevitDetail(
  actor: RevitActor,
  project: { id: string; jobNumber: string; jobName: string },
  input: LibraryInput,
) {
  const name = (input.name || "").trim();
  const filePath = (input.filePath || "").trim();
  if (!name) throw new Error("Detail name is required.");
  if (!filePath) throw new Error("Paste the network path to the typical detail.");

  const orgSlug = actor.organizationSlug || ORG_SLUG;
  const linked = input.linkToJob !== false;
  const detail = await prisma.typicalDetail.create({
    data: {
      organizationId: actor.organizationId,
      name,
      description: (input.description || "").trim(),
      category: (input.category || "Other").trim() || "Other",
      materials: (input.materials || "").trim(),
      keywords: (input.keywords || "").trim(),
      filePath,
      drawnIn: (input.drawnIn || "Revit").trim() || "Revit",
      projectId: linked ? project.id : null,
      jobNumber: linked ? project.jobNumber : "",
      jobName: linked ? project.jobName : "",
      createdById: actor.userId,
    },
  });

  const uploaded = await uploadLibraryScreenshot(
    actor,
    orgSlug,
    `details/${detail.id}`,
    input,
  );
  if (uploaded) {
    await prisma.typicalDetailImage.create({
      data: {
        detailId: detail.id,
        fileName: uploaded.fileName,
        fileMimeType: uploaded.fileMimeType,
        sharePointItemId: uploaded.sharePointItemId,
        sharePointWebUrl: uploaded.sharePointWebUrl,
        localFilePath: uploaded.localFilePath,
        sortOrder: 0,
      },
    });
  }

  await syncLibraryFeedEntry({
    organizationId: actor.organizationId,
    userId: actor.userId,
    kind: "typical-detail",
    libraryId: detail.id,
    projectId: linked ? project.id : null,
    name: detail.name,
    description: detail.description,
    category: detail.category,
    filePath: detail.filePath,
    image: uploaded,
  });

  await logActivity({
    organizationId: actor.organizationId,
    projectId: linked ? project.id : null,
    userId: actor.userId,
    action: "added typical detail",
    detail: name,
  });

  revalidatePath("/app/details");
  revalidatePath("/app");

  return detail;
}

export async function addRevitIssue(
  actor: RevitActor,
  project: { id: string; jobNumber: string; jobName: string } | null,
  input: LibraryInput,
) {
  const name = (input.name || "").trim();
  const description = (input.description || "").trim();
  if (!name) throw new Error("Give the issue a short title.");
  if (!description) throw new Error("Explain the issue.");

  const orgSlug = actor.organizationSlug || ORG_SLUG;
  const linked = Boolean(project) && input.linkToJob !== false;
  const status =
    (input.status || "").trim() === "Resolved"
      ? "Resolved"
      : "Needs attention";
  const issue = await prisma.technicalIssue.create({
    data: {
      organizationId: actor.organizationId,
      name,
      description,
      workaround: (input.workaround || "").trim(),
      category: (input.category || "Other").trim() || "Other",
      keywords: (input.keywords || "").trim(),
      status,
      projectId: linked && project ? project.id : null,
      jobNumber: linked && project ? project.jobNumber : "",
      jobName: linked && project ? project.jobName : "",
      revitVersion: (input.revitVersion || "").trim(),
      createdById: actor.userId,
    },
  });

  const uploaded = await uploadLibraryScreenshot(
    actor,
    orgSlug,
    `issues/${issue.id}`,
    input,
  );
  if (uploaded) {
    await prisma.technicalIssueImage.create({
      data: {
        issueId: issue.id,
        fileName: uploaded.fileName,
        fileMimeType: uploaded.fileMimeType,
        sharePointItemId: uploaded.sharePointItemId,
        sharePointWebUrl: uploaded.sharePointWebUrl,
        localFilePath: uploaded.localFilePath,
        sortOrder: 0,
      },
    });
  }

  await syncLibraryFeedEntry({
    organizationId: actor.organizationId,
    userId: actor.userId,
    kind: "technical-issue",
    libraryId: issue.id,
    projectId: linked && project ? project.id : null,
    name: issue.name,
    description: issue.description,
    category: issue.category,
    filePath: "",
    status: issue.status,
    workaround: issue.workaround,
    image: uploaded,
  });

  await logActivity({
    organizationId: actor.organizationId,
    projectId: linked && project ? project.id : null,
    userId: actor.userId,
    action: "added technical issue",
    detail: name,
  });

  revalidatePath("/app/issues");
  revalidatePath("/app");

  return issue;
}
