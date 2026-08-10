"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { ORG_SLUG } from "@/lib/constants";

function splitList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function ownedFamily(familyId: string, organizationId: string) {
  return prisma.family.findFirst({
    where: { id: familyId, organizationId },
    include: { organization: true, images: true },
  });
}

export async function addFamily(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "Other").trim();
  const materials = String(formData.get("materials") || "").trim();
  const keywords = String(formData.get("keywords") || "").trim();
  const filePath = String(formData.get("filePath") || "").trim();
  const jobNumber = String(formData.get("jobNumber") || "").trim();
  const jobName = String(formData.get("jobName") || "").trim();
  const revitVersion = String(formData.get("revitVersion") || "").trim();

  if (!name) throw new Error("Family name is required.");
  if (!filePath) throw new Error("Paste the network path to the .rfa file.");

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organisation not found");

  const family = await prisma.family.create({
    data: {
      organizationId: orgId,
      name,
      description,
      category,
      materials,
      keywords,
      filePath,
      jobNumber,
      jobName,
      revitVersion,
      createdById: session.user.id,
    },
  });

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  let order = 0;
  for (const file of files) {
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name)) {
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await storeUpload({
      userId: session.user.id,
      orgSlug: org.slug || ORG_SLUG,
      projectNumber: `families/${family.id}`,
      fileName: file.name,
      mimeType: file.type || "image/png",
      bytes,
    });
    await prisma.familyImage.create({
      data: {
        familyId: family.id,
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

  await logActivity({
    organizationId: orgId,
    userId: session.user.id,
    action: "added family",
    detail: name,
  });

  revalidatePath("/app/families");
  revalidatePath("/app");
}

export async function updateFamily(familyId: string, formData: FormData) {
  const session = await requireSession();
  const family = await ownedFamily(familyId, session.user.organizationId!);
  if (!family) throw new Error("Family not found");

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "Other").trim();
  const materials = String(formData.get("materials") || "").trim();
  const keywords = String(formData.get("keywords") || "").trim();
  const filePath = String(formData.get("filePath") || "").trim();
  const jobNumber = String(formData.get("jobNumber") || "").trim();
  const jobName = String(formData.get("jobName") || "").trim();
  const revitVersion = String(formData.get("revitVersion") || "").trim();

  if (!name) throw new Error("Family name is required.");
  if (!filePath) throw new Error("Paste the network path to the .rfa file.");

  await prisma.family.update({
    where: { id: familyId },
    data: {
      name,
      description,
      category,
      materials,
      keywords,
      filePath,
      jobNumber,
      jobName,
      revitVersion,
    },
  });

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  let order = family.images.length;
  for (const file of files) {
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|bmp|webp)$/i.test(file.name)) {
      continue;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await storeUpload({
      userId: session.user.id,
      orgSlug: family.organization.slug || ORG_SLUG,
      projectNumber: `families/${family.id}`,
      fileName: file.name,
      mimeType: file.type || "image/png",
      bytes,
    });
    await prisma.familyImage.create({
      data: {
        familyId: family.id,
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

  await logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    action: "updated family",
    detail: name,
  });

  revalidatePath("/app/families");
}

export async function deleteFamily(familyId: string) {
  const session = await requireSession();
  const family = await ownedFamily(familyId, session.user.organizationId!);
  if (!family) throw new Error("Family not found");

  await prisma.family.delete({ where: { id: familyId } });

  await logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    action: "removed family",
    detail: family.name,
  });

  revalidatePath("/app/families");
}

export async function deleteFamilyImage(imageId: string) {
  const session = await requireSession();
  const image = await prisma.familyImage.findUnique({
    where: { id: imageId },
    include: { family: true },
  });
  if (!image || image.family.organizationId !== session.user.organizationId) {
    throw new Error("Image not found");
  }
  await prisma.familyImage.delete({ where: { id: imageId } });
  revalidatePath("/app/families");
}

export async function listFamilyMaterialHints(organizationId: string) {
  const rows = await prisma.family.findMany({
    where: { organizationId },
    select: { materials: true },
  });
  const set = new Set<string>();
  for (const row of rows) {
    for (const m of splitList(row.materials)) set.add(m);
  }
  return Array.from(set).sort();
}
