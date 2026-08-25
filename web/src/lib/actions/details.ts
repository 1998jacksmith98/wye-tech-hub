"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { ORG_SLUG } from "@/lib/constants";
import {
  removeLibraryFeedEntry,
  resolveLinkedProject,
  syncLibraryFeedEntry,
} from "@/lib/library-feed";

async function ownedDetail(detailId: string, organizationId: string) {
  return prisma.typicalDetail.findFirst({
    where: { id: detailId, organizationId },
    include: { organization: true, images: true },
  });
}

async function firstDetailImage(detailId: string) {
  return prisma.typicalDetailImage.findFirst({
    where: { detailId },
    orderBy: { sortOrder: "asc" },
  });
}

async function publishDetailToFeed(params: {
  organizationId: string;
  userId: string;
  detailId: string;
  projectId: string | null;
  name: string;
  description: string;
  category: string;
  filePath: string;
}) {
  const image = await firstDetailImage(params.detailId);
  await syncLibraryFeedEntry({
    ...params,
    kind: "typical-detail",
    libraryId: params.detailId,
    image,
  });
}

async function saveImages(
  formData: FormData,
  params: {
    userId: string;
    orgSlug: string;
    detailId: string;
    startOrder: number;
  },
) {
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  let order = params.startOrder;
  for (const file of files) {
    if (
      !file.type.startsWith("image/") &&
      !/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name)
    ) {
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await storeUpload({
      userId: params.userId,
      orgSlug: params.orgSlug,
      projectNumber: `details/${params.detailId}`,
      fileName: file.name,
      mimeType: file.type || "image/png",
      bytes,
    });
    await prisma.typicalDetailImage.create({
      data: {
        detailId: params.detailId,
        fileName: uploaded.fileName,
        fileMimeType: uploaded.fileMimeType,
        sharePointItemId: uploaded.sharePointItemId,
        sharePointWebUrl: uploaded.sharePointWebUrl,
        localFilePath: uploaded.localFilePath,
        sortOrder: order,
      },
    });
    order += 1;
  }
}

export async function addTypicalDetail(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "Other").trim();
  const materials = String(formData.get("materials") || "").trim();
  const keywords = String(formData.get("keywords") || "").trim();
  const filePath = String(formData.get("filePath") || "").trim();
  const drawnIn = String(formData.get("drawnIn") || "").trim();
  const project = await resolveLinkedProject(
    orgId,
    String(formData.get("projectId") || ""),
  );

  if (!name) throw new Error("Detail name is required.");
  if (!filePath) throw new Error("Paste the network path to the typical detail.");

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organisation not found");

  const detail = await prisma.typicalDetail.create({
    data: {
      organizationId: orgId,
      name,
      description,
      category,
      materials,
      keywords,
      filePath,
      drawnIn,
      projectId: project?.id || null,
      jobNumber: project?.jobNumber || "",
      jobName: project?.jobName || "",
      createdById: session.user.id,
    },
  });

  await saveImages(formData, {
    userId: session.user.id,
    orgSlug: org.slug || ORG_SLUG,
    detailId: detail.id,
    startOrder: 0,
  });

  await publishDetailToFeed({
    organizationId: orgId,
    userId: session.user.id,
    detailId: detail.id,
    projectId: project?.id || null,
    name,
    description,
    category,
    filePath,
  });

  await logActivity({
    organizationId: orgId,
    projectId: project?.id || null,
    userId: session.user.id,
    action: "added typical detail",
    detail: name,
  });

  revalidatePath("/app/details");
  revalidatePath("/app");
}

export async function updateTypicalDetail(detailId: string, formData: FormData) {
  const session = await requireSession();
  const existing = await ownedDetail(detailId, session.user.organizationId!);
  if (!existing) throw new Error("Detail not found");

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "Other").trim();
  const materials = String(formData.get("materials") || "").trim();
  const keywords = String(formData.get("keywords") || "").trim();
  const filePath = String(formData.get("filePath") || "").trim();
  const drawnIn = String(formData.get("drawnIn") || "").trim();
  const project = await resolveLinkedProject(
    session.user.organizationId!,
    String(formData.get("projectId") || ""),
  );

  if (!name) throw new Error("Detail name is required.");
  if (!filePath) throw new Error("Paste the network path to the typical detail.");

  await prisma.typicalDetail.update({
    where: { id: detailId },
    data: {
      name,
      description,
      category,
      materials,
      keywords,
      filePath,
      drawnIn,
      projectId: project?.id || null,
      jobNumber: project?.jobNumber || "",
      jobName: project?.jobName || "",
    },
  });

  await saveImages(formData, {
    userId: session.user.id,
    orgSlug: existing.organization.slug || ORG_SLUG,
    detailId,
    startOrder: existing.images.length,
  });

  await publishDetailToFeed({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    detailId,
    projectId: project?.id || null,
    name,
    description,
    category,
    filePath,
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: project?.id || null,
    userId: session.user.id,
    action: "updated typical detail",
    detail: name,
  });

  revalidatePath("/app/details");
}

export async function deleteTypicalDetail(detailId: string) {
  const session = await requireSession();
  const existing = await ownedDetail(detailId, session.user.organizationId!);
  if (!existing) throw new Error("Detail not found");

  await prisma.typicalDetail.delete({ where: { id: detailId } });
  await removeLibraryFeedEntry({
    organizationId: session.user.organizationId!,
    kind: "typical-detail",
    libraryId: detailId,
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    action: "removed typical detail",
    detail: existing.name,
  });

  revalidatePath("/app/details");
}

export async function deleteTypicalDetailImage(imageId: string) {
  const session = await requireSession();
  const image = await prisma.typicalDetailImage.findUnique({
    where: { id: imageId },
    include: { detail: true },
  });
  if (!image || image.detail.organizationId !== session.user.organizationId) {
    throw new Error("Image not found");
  }
  await prisma.typicalDetailImage.delete({ where: { id: imageId } });
  revalidatePath("/app/details");
}
