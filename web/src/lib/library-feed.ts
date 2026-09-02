import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/utils";

export type LibraryKind = "typical-detail" | "family" | "technical-issue";

export const LIBRARY_FEED_TOPIC = {
  "typical-detail": "Typical details",
  family: "Project specific families",
  "technical-issue": "Technical issues",
} as const;

export const LIBRARY_FEED_SOURCE = {
  "typical-detail": "Details",
  family: "Families",
  "technical-issue": "Technical issues",
} as const;

export const LIBRARY_FEED_HREF = {
  "typical-detail": "/app/details",
  family: "/app/families",
  "technical-issue": "/app/issues",
} as const;

function alwaysOnMasterFeed(kind: LibraryKind) {
  return kind === "technical-issue";
}

export async function resolveLinkedProject(
  organizationId: string,
  projectId: string,
): Promise<{ id: string; jobNumber: string; jobName: string } | null> {
  const id = projectId.trim();
  if (!id) return null;
  return prisma.project.findFirst({
    where: { id, organizationId },
    select: { id: true, jobNumber: true, jobName: true },
  });
}

type FeedImage = {
  fileName: string;
  fileMimeType?: string | null;
  sharePointItemId?: string | null;
  sharePointWebUrl?: string | null;
  localFilePath?: string | null;
};

function isLibraryEntry(
  tagsJson: string,
  kind: LibraryKind,
  libraryId: string,
) {
  const tags = parseTags(tagsJson);
  return tags.libraryKind === kind && tags.libraryId === libraryId;
}

async function findLibraryEntry(
  organizationId: string,
  kind: LibraryKind,
  libraryId: string,
) {
  const rows = await prisma.entry.findMany({
    where: {
      organizationId,
      tagsJson: { contains: `"libraryId":"${libraryId}"` },
    },
  });
  return rows.find((row) => isLibraryEntry(row.tagsJson, kind, libraryId));
}

function feedText(params: {
  kind: LibraryKind;
  name: string;
  description: string;
  category: string;
  filePath: string;
  status?: string;
  workaround?: string;
}) {
  const heading =
    params.kind === "typical-detail"
      ? "Typical detail"
      : params.kind === "technical-issue"
        ? "Technical issue"
        : "Project specific family";
  const parts = [`${heading}: ${params.name}`];
  if (params.status?.trim()) parts.push(`Status: ${params.status.trim()}`);
  if (params.description.trim()) parts.push(params.description.trim());
  if (params.workaround?.trim()) {
    parts.push(`Workaround / fix:\n${params.workaround.trim()}`);
  }
  if (params.category.trim()) parts.push(`Category: ${params.category.trim()}`);
  if (params.filePath.trim()) parts.push(`Path: ${params.filePath.trim()}`);
  return parts.join("\n\n");
}

function feedStatusTag(status?: string) {
  return status === "Resolved" ? "Resolved" : "Action Required";
}

export async function syncLibraryFeedEntry(params: {
  organizationId: string;
  userId: string;
  kind: LibraryKind;
  libraryId: string;
  projectId: string | null;
  name: string;
  description: string;
  category: string;
  filePath: string;
  status?: string;
  workaround?: string;
  image?: FeedImage | null;
  skipIfExists?: boolean;
}) {
  const existing = await findLibraryEntry(
    params.organizationId,
    params.kind,
    params.libraryId,
  );

  if (!params.projectId && !alwaysOnMasterFeed(params.kind)) {
    if (existing) {
      const previousProjectId = existing.projectId;
      await prisma.entry.delete({ where: { id: existing.id } });
      if (previousProjectId) revalidatePath(`/app/projects/${previousProjectId}`);
      revalidatePath("/app/feed");
    }
    return;
  }

  if (params.skipIfExists && existing) return;

  const tags: Record<string, string> = {
    topic: LIBRARY_FEED_TOPIC[params.kind],
    source: LIBRARY_FEED_SOURCE[params.kind],
    libraryKind: params.kind,
    libraryId: params.libraryId,
  };
  if (params.kind === "technical-issue") {
    tags.status = feedStatusTag(params.status);
  }
  const image = params.image;
  const data = {
    organizationId: params.organizationId,
    projectId: params.projectId,
    contentType: image?.fileName ? "Screenshot" : "Note",
    textContent: feedText(params),
    linkUrl: LIBRARY_FEED_HREF[params.kind],
    tagsJson: JSON.stringify(tags),
    createdById: params.userId || null,
    fileName: image?.fileName || null,
    fileMimeType: image?.fileMimeType || null,
    sharePointItemId: image?.sharePointItemId || null,
    sharePointWebUrl: image?.sharePointWebUrl || null,
    localFilePath: image?.localFilePath || null,
  };

  const previousProjectId = existing?.projectId || null;
  if (existing) {
    await prisma.entry.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.entry.create({ data });
  }

  if (previousProjectId && previousProjectId !== params.projectId) {
    revalidatePath(`/app/projects/${previousProjectId}`);
  }
  if (params.projectId) revalidatePath(`/app/projects/${params.projectId}`);
  revalidatePath("/app/feed");
}

export async function ensureProjectLibraryFeed(params: {
  organizationId: string;
  projectId: string;
}) {
  const [details, families, issues] = await Promise.all([
    prisma.typicalDetail.findMany({
      where: {
        organizationId: params.organizationId,
        projectId: params.projectId,
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    prisma.family.findMany({
      where: {
        organizationId: params.organizationId,
        projectId: params.projectId,
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    prisma.technicalIssue.findMany({
      where: {
        organizationId: params.organizationId,
        projectId: params.projectId,
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
  ]);

  for (const detail of details) {
    await syncLibraryFeedEntry({
      organizationId: params.organizationId,
      userId: detail.createdById || "",
      kind: "typical-detail",
      libraryId: detail.id,
      projectId: params.projectId,
      name: detail.name,
      description: detail.description,
      category: detail.category,
      filePath: detail.filePath,
      image: detail.images[0] || null,
      skipIfExists: true,
    });
  }

  for (const family of families) {
    await syncLibraryFeedEntry({
      organizationId: params.organizationId,
      userId: family.createdById || "",
      kind: "family",
      libraryId: family.id,
      projectId: params.projectId,
      name: family.name,
      description: family.description,
      category: family.category,
      filePath: family.filePath,
      image: family.images[0] || null,
      skipIfExists: true,
    });
  }

  for (const issue of issues) {
    await syncLibraryFeedEntry({
      organizationId: params.organizationId,
      userId: issue.createdById || "",
      kind: "technical-issue",
      libraryId: issue.id,
      projectId: params.projectId,
      name: issue.name,
      description: issue.description,
      category: issue.category,
      filePath: "",
      status: issue.status,
      workaround: issue.workaround,
      image: issue.images[0] || null,
      skipIfExists: true,
    });
  }
}

export async function removeLibraryFeedEntry(params: {
  organizationId: string;
  kind: LibraryKind;
  libraryId: string;
}) {
  const existing = await findLibraryEntry(
    params.organizationId,
    params.kind,
    params.libraryId,
  );
  if (!existing) return;
  await prisma.entry.delete({ where: { id: existing.id } });
  if (existing.projectId) revalidatePath(`/app/projects/${existing.projectId}`);
  revalidatePath("/app/feed");
}
