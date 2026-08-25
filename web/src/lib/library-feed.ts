import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/utils";

export type LibraryKind = "typical-detail" | "family";

export const LIBRARY_FEED_TOPIC = {
  "typical-detail": "Typical details",
  family: "Project specific families",
} as const;

export const LIBRARY_FEED_SOURCE = {
  "typical-detail": "Details",
  family: "Families",
} as const;

export const LIBRARY_FEED_HREF = {
  "typical-detail": "/app/details",
  family: "/app/families",
} as const;

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
}) {
  const heading =
    params.kind === "typical-detail" ? "Typical detail" : "Project specific family";
  const parts = [`${heading}: ${params.name}`];
  if (params.description.trim()) parts.push(params.description.trim());
  if (params.category.trim()) parts.push(`Category: ${params.category.trim()}`);
  if (params.filePath.trim()) parts.push(`Path: ${params.filePath.trim()}`);
  return parts.join("\n\n");
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
  image?: FeedImage | null;
  skipIfExists?: boolean;
}) {
  const existing = await findLibraryEntry(
    params.organizationId,
    params.kind,
    params.libraryId,
  );

  if (!params.projectId) {
    if (existing) {
      const previousProjectId = existing.projectId;
      await prisma.entry.delete({ where: { id: existing.id } });
      if (previousProjectId) revalidatePath(`/app/projects/${previousProjectId}`);
      revalidatePath("/app/feed");
    }
    return;
  }

  if (params.skipIfExists && existing) return;

  const tags = {
    topic: LIBRARY_FEED_TOPIC[params.kind],
    source: LIBRARY_FEED_SOURCE[params.kind],
    libraryKind: params.kind,
    libraryId: params.libraryId,
  };
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
  revalidatePath(`/app/projects/${params.projectId}`);
  revalidatePath("/app/feed");
}

export async function ensureProjectLibraryFeed(params: {
  organizationId: string;
  projectId: string;
}) {
  const [details, families] = await Promise.all([
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
