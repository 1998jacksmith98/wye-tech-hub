"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { GUIDE_CATEGORIES, ORG_SLUG } from "@/lib/constants";
import {
  guideMimeType,
  isAllowedBlobUrl,
  isGuideFileName,
} from "@/lib/guides";

async function ownedGuide(guideId: string, organizationId: string) {
  return prisma.guide.findFirst({
    where: { id: guideId, organizationId },
    include: { organization: true },
  });
}

function readMeta(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const rawCategory = String(formData.get("category") || "Other").trim();
  const category = (GUIDE_CATEGORIES as readonly string[]).includes(rawCategory)
    ? rawCategory
    : "Other";
  const keywords = String(formData.get("keywords") || "").trim();
  if (!title) throw new Error("Give the guide a title.");
  return { title, summary, category, keywords };
}

async function iconFromForm(formData: FormData, orgSlug: string, userId: string) {
  const file = formData.get("icon");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
    throw new Error("The picture needs to be an image (PNG, JPG, GIF, or WebP).");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await storeUpload({
    userId,
    orgSlug,
    projectNumber: "guides/icons",
    fileName: file.name || "guide-icon.png",
    mimeType: file.type || "image/png",
    bytes,
  });
  return {
    iconFileName: uploaded.fileName,
    iconMimeType: uploaded.fileMimeType,
    iconSharePointItemId: uploaded.sharePointItemId,
    iconSharePointWebUrl: uploaded.sharePointWebUrl,
    iconLocalFilePath: uploaded.localFilePath,
  };
}

async function fileFromForm(
  formData: FormData,
  orgSlug: string,
  userId: string,
) {
  const blobUrl = String(formData.get("blobUrl") || "").trim();
  const blobPath = String(formData.get("blobPath") || "").trim();
  const blobName = String(formData.get("blobFileName") || "").trim();
  if (blobUrl) {
    if (!isAllowedBlobUrl(blobUrl)) {
      throw new Error("That file upload did not come from Tech Hub storage.");
    }
    if (!isGuideFileName(blobName)) {
      throw new Error("Upload a Word document (.doc, .docx) or PowerPoint (.ppt, .pptx).");
    }
    return {
      fileName: blobName,
      fileMimeType: guideMimeType(blobName),
      sharePointItemId: blobPath || undefined,
      sharePointWebUrl: blobUrl,
      localFilePath: undefined as string | undefined,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!isGuideFileName(file.name)) {
    throw new Error("Upload a Word document (.doc, .docx) or PowerPoint (.ppt, .pptx).");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  return storeUpload({
    userId,
    orgSlug,
    projectNumber: "guides",
    fileName: file.name,
    mimeType: guideMimeType(file.name, file.type),
    bytes,
  });
}

export async function addGuide(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;
  const { title, summary, category, keywords } = readMeta(formData);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organisation not found");

  const uploaded = await fileFromForm(formData, org.slug || ORG_SLUG, session.user.id);
  if (!uploaded?.fileName) {
    throw new Error("Attach a Word or PowerPoint file.");
  }
  const icon = await iconFromForm(formData, org.slug || ORG_SLUG, session.user.id);

  await prisma.guide.create({
    data: {
      organizationId: orgId,
      title,
      summary,
      category,
      keywords,
      fileName: uploaded.fileName,
      fileMimeType: uploaded.fileMimeType,
      sharePointItemId: uploaded.sharePointItemId,
      sharePointWebUrl: uploaded.sharePointWebUrl,
      localFilePath: uploaded.localFilePath,
      createdById: session.user.id,
      ...(icon || {}),
    },
  });

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    action: "added guide",
    detail: title,
  });

  revalidatePath("/app/guides");
}

export async function updateGuide(guideId: string, formData: FormData) {
  const session = await requireSession();
  const guide = await ownedGuide(guideId, session.user.organizationId!);
  if (!guide) throw new Error("Guide not found");

  const { title, summary, category, keywords } = readMeta(formData);
  const uploaded = await fileFromForm(
    formData,
    guide.organization.slug || ORG_SLUG,
    session.user.id,
  );
  const removeIcon = String(formData.get("removeIcon") || "") === "on";
  const icon = removeIcon
    ? null
    : await iconFromForm(formData, guide.organization.slug || ORG_SLUG, session.user.id);

  await prisma.guide.update({
    where: { id: guideId },
    data: {
      title,
      summary,
      category,
      keywords,
      ...(uploaded?.fileName
        ? {
            fileName: uploaded.fileName,
            fileMimeType: uploaded.fileMimeType,
            sharePointItemId: uploaded.sharePointItemId,
            sharePointWebUrl: uploaded.sharePointWebUrl,
            localFilePath: uploaded.localFilePath,
          }
        : {}),
      ...(removeIcon
        ? {
            iconFileName: null,
            iconMimeType: null,
            iconSharePointItemId: null,
            iconSharePointWebUrl: null,
            iconLocalFilePath: null,
          }
        : icon || {}),
    },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    action: "updated guide",
    detail: title,
  });

  revalidatePath("/app/guides");
}

export async function deleteGuide(guideId: string) {
  const session = await requireSession();
  const guide = await ownedGuide(guideId, session.user.organizationId!);
  if (!guide) throw new Error("Guide not found");

  await prisma.guide.delete({ where: { id: guideId } });

  await logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    action: "removed guide",
    detail: guide.title,
  });

  revalidatePath("/app/guides");
}
