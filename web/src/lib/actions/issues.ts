"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { ISSUE_STATUSES, ORG_SLUG } from "@/lib/constants";
import {
  removeLibraryFeedEntry,
  resolveLinkedProject,
  syncLibraryFeedEntry,
} from "@/lib/library-feed";

function normalizeStatus(value: string) {
  return ISSUE_STATUSES.includes(value as (typeof ISSUE_STATUSES)[number])
    ? value
    : "Needs attention";
}

async function ownedIssue(issueId: string, organizationId: string) {
  return prisma.technicalIssue.findFirst({
    where: { id: issueId, organizationId },
    include: { organization: true, images: true },
  });
}

async function firstIssueImage(issueId: string) {
  return prisma.technicalIssueImage.findFirst({
    where: { issueId },
    orderBy: { sortOrder: "asc" },
  });
}

async function publishIssueToFeed(params: {
  organizationId: string;
  userId: string;
  issueId: string;
  projectId: string | null;
  name: string;
  description: string;
  workaround: string;
  category: string;
  status: string;
}) {
  const image = await firstIssueImage(params.issueId);
  await syncLibraryFeedEntry({
    organizationId: params.organizationId,
    userId: params.userId,
    kind: "technical-issue",
    libraryId: params.issueId,
    projectId: params.projectId,
    name: params.name,
    description: params.description,
    category: params.category,
    filePath: "",
    status: params.status,
    workaround: params.workaround,
    image,
  });
}

async function saveImages(
  formData: FormData,
  params: {
    issueId: string;
    userId: string;
    orgSlug: string;
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
      orgSlug: params.orgSlug || ORG_SLUG,
      projectNumber: `issues/${params.issueId}`,
      fileName: file.name,
      mimeType: file.type || "image/png",
      bytes,
    });
    await prisma.technicalIssueImage.create({
      data: {
        issueId: params.issueId,
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

export async function addTechnicalIssue(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const workaround = String(formData.get("workaround") || "").trim();
  const category = String(formData.get("category") || "Other").trim() || "Other";
  const keywords = String(formData.get("keywords") || "").trim();
  const status = normalizeStatus(String(formData.get("status") || ""));
  const revitVersion = String(formData.get("revitVersion") || "").trim();
  const project = await resolveLinkedProject(
    orgId,
    String(formData.get("projectId") || ""),
  );

  if (!name) throw new Error("Give the issue a short title.");
  if (!description) throw new Error("Explain the issue.");

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organisation not found");

  const issue = await prisma.technicalIssue.create({
    data: {
      organizationId: orgId,
      name,
      description,
      workaround,
      category,
      keywords,
      status,
      projectId: project?.id || null,
      jobNumber: project?.jobNumber || "",
      jobName: project?.jobName || "",
      revitVersion,
      createdById: session.user.id,
    },
  });

  await saveImages(formData, {
    issueId: issue.id,
    userId: session.user.id,
    orgSlug: org.slug || ORG_SLUG,
    startOrder: 0,
  });

  await publishIssueToFeed({
    organizationId: orgId,
    userId: session.user.id,
    issueId: issue.id,
    projectId: project?.id || null,
    name,
    description,
    workaround,
    category,
    status,
  });

  await logActivity({
    organizationId: orgId,
    projectId: project?.id || null,
    userId: session.user.id,
    action: "added technical issue",
    detail: name,
  });

  revalidatePath("/app/issues");
  revalidatePath("/app");
}

export async function updateTechnicalIssue(issueId: string, formData: FormData) {
  const session = await requireSession();
  const issue = await ownedIssue(issueId, session.user.organizationId!);
  if (!issue) throw new Error("Issue not found");

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const workaround = String(formData.get("workaround") || "").trim();
  const category = String(formData.get("category") || "Other").trim() || "Other";
  const keywords = String(formData.get("keywords") || "").trim();
  const status = normalizeStatus(String(formData.get("status") || ""));
  const revitVersion = String(formData.get("revitVersion") || "").trim();
  const project = await resolveLinkedProject(
    session.user.organizationId!,
    String(formData.get("projectId") || ""),
  );

  if (!name) throw new Error("Give the issue a short title.");
  if (!description) throw new Error("Explain the issue.");

  await prisma.technicalIssue.update({
    where: { id: issueId },
    data: {
      name,
      description,
      workaround,
      category,
      keywords,
      status,
      projectId: project?.id || null,
      jobNumber: project?.jobNumber || "",
      jobName: project?.jobName || "",
      revitVersion,
    },
  });

  await saveImages(formData, {
    issueId: issue.id,
    userId: session.user.id,
    orgSlug: issue.organization.slug || ORG_SLUG,
    startOrder: issue.images.length,
  });

  await publishIssueToFeed({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    issueId: issue.id,
    projectId: project?.id || null,
    name,
    description,
    workaround,
    category,
    status,
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: project?.id || null,
    userId: session.user.id,
    action: "updated technical issue",
    detail: name,
  });

  revalidatePath("/app/issues");
}

export async function deleteTechnicalIssue(issueId: string) {
  const session = await requireSession();
  const issue = await ownedIssue(issueId, session.user.organizationId!);
  if (!issue) throw new Error("Issue not found");

  await prisma.technicalIssue.delete({ where: { id: issueId } });
  await removeLibraryFeedEntry({
    organizationId: session.user.organizationId!,
    kind: "technical-issue",
    libraryId: issueId,
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    action: "removed technical issue",
    detail: issue.name,
  });

  revalidatePath("/app/issues");
}

export async function deleteTechnicalIssueImage(imageId: string) {
  const session = await requireSession();
  const image = await prisma.technicalIssueImage.findUnique({
    where: { id: imageId },
    include: { issue: true },
  });
  if (!image || image.issue.organizationId !== session.user.organizationId) {
    throw new Error("Image not found");
  }
  await prisma.technicalIssueImage.delete({ where: { id: imageId } });
  revalidatePath("/app/issues");
}
