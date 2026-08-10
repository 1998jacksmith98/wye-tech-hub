"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { storeUpload } from "@/lib/files";
import { ORG_SLUG } from "@/lib/constants";

function parseEntryForm(formData: FormData) {
  const contentType = String(formData.get("contentType") || "note").toLowerCase();
  const textContent = String(formData.get("textContent") || "").trim();
  const linkUrl = String(formData.get("linkUrl") || "").trim();
  const rawTags: Record<string, string> = {
    source: String(formData.get("source") || "").trim(),
    person: String(formData.get("person") || "").trim(),
    topic: String(formData.get("topic") || "").trim(),
    status: String(formData.get("status") || "").trim(),
  };
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawTags)) {
    if (value && value !== "—") tags[key] = value;
  }
  return { contentType, textContent, linkUrl, tags };
}

async function uploadFromForm(
  formData: FormData,
  userId: string,
  orgSlug: string,
  projectNumber: string,
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return {};

  const bytes = Buffer.from(await file.arrayBuffer());
  return storeUpload({
    userId,
    orgSlug,
    projectNumber,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
  });
}

export async function addEntry(projectId: string, formData: FormData) {
  const session = await requireSession();
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: session.user.organizationId! },
    include: { organization: true },
  });
  if (!project) throw new Error("Project not found");

  const { contentType, textContent, linkUrl, tags } = parseEntryForm(formData);
  const fileMeta = await uploadFromForm(
    formData,
    session.user.id,
    project.organization.slug || ORG_SLUG,
    project.jobNumber,
  );

  if (!textContent && !fileMeta.fileName && !linkUrl) {
    throw new Error("Add text, a file, or a link.");
  }

  await prisma.entry.create({
    data: {
      organizationId: session.user.organizationId!,
      projectId,
      contentType,
      textContent,
      linkUrl,
      tagsJson: JSON.stringify(tags),
      createdById: session.user.id,
      fileName: fileMeta.fileName,
      fileMimeType: fileMeta.fileMimeType,
      sharePointItemId: fileMeta.sharePointItemId,
      sharePointWebUrl: fileMeta.sharePointWebUrl,
      localFilePath: fileMeta.localFilePath,
    },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId,
    userId: session.user.id,
    action: `added ${contentType}`,
    detail: textContent.slice(0, 60) || fileMeta.fileName || linkUrl,
  });

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app/feed");
}

export async function addLibraryEntry(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;
  const scope = String(formData.get("scope") || "project").trim();
  const projectId = String(formData.get("projectId") || "").trim();

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organisation not found");

  let linkedProject: {
    id: string;
    jobNumber: string;
    jobName: string;
  } | null = null;

  if (scope !== "generic") {
    if (!projectId) throw new Error("Select a project, or choose Generic issue.");
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true, jobNumber: true, jobName: true },
    });
    if (!project) throw new Error("Project not found");
    linkedProject = project;
  }

  const { contentType, textContent, linkUrl, tags } = parseEntryForm(formData);
  const fileMeta = await uploadFromForm(
    formData,
    session.user.id,
    org.slug || ORG_SLUG,
    linkedProject?.jobNumber || "generic",
  );

  if (!textContent && !fileMeta.fileName && !linkUrl) {
    throw new Error("Add text, a file, or a link.");
  }

  await prisma.entry.create({
    data: {
      organizationId: orgId,
      projectId: linkedProject?.id || null,
      contentType,
      textContent,
      linkUrl,
      tagsJson: JSON.stringify(tags),
      createdById: session.user.id,
      fileName: fileMeta.fileName,
      fileMimeType: fileMeta.fileMimeType,
      sharePointItemId: fileMeta.sharePointItemId,
      sharePointWebUrl: fileMeta.sharePointWebUrl,
      localFilePath: fileMeta.localFilePath,
    },
  });

  await logActivity({
    organizationId: orgId,
    projectId: linkedProject?.id || null,
    userId: session.user.id,
    action: linkedProject
      ? `added ${contentType}`
      : `added generic ${contentType}`,
    detail: textContent.slice(0, 60) || fileMeta.fileName || linkUrl,
  });

  if (linkedProject) revalidatePath(`/app/projects/${linkedProject.id}`);
  revalidatePath("/app/feed");
  revalidatePath("/app");
}

async function getOwnedEntry(entryId: string, organizationId: string) {
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { project: { include: { organization: true } }, organization: true },
  });
  if (!entry) return null;

  const entryOrgId =
    entry.organizationId ||
    entry.project?.organizationId ||
    entry.organization?.id;

  if (entryOrgId !== organizationId) return null;
  return entry;
}

export async function updateEntry(entryId: string, formData: FormData) {
  const session = await requireSession();
  const entry = await getOwnedEntry(entryId, session.user.organizationId!);
  if (!entry) throw new Error("Entry not found");

  const { contentType, textContent, linkUrl, tags } = parseEntryForm(formData);
  const orgSlug =
    entry.organization?.slug ||
    entry.project?.organization.slug ||
    ORG_SLUG;
  const projectNumber = entry.project?.jobNumber || "generic";

  const fileMeta = await uploadFromForm(
    formData,
    session.user.id,
    orgSlug,
    projectNumber,
  );

  if (!textContent && !linkUrl && !fileMeta.fileName && !entry.fileName) {
    throw new Error("Add text, a file, or a link.");
  }

  await prisma.entry.update({
    where: { id: entryId },
    data: {
      contentType,
      textContent,
      linkUrl,
      tagsJson: JSON.stringify(tags),
      ...(fileMeta.fileName
        ? {
            fileName: fileMeta.fileName,
            fileMimeType: fileMeta.fileMimeType,
            sharePointItemId: fileMeta.sharePointItemId,
            sharePointWebUrl: fileMeta.sharePointWebUrl,
            localFilePath: fileMeta.localFilePath,
          }
        : {}),
    },
  });

  await logActivity({
    organizationId: session.user.organizationId!,
    projectId: entry.projectId,
    userId: session.user.id,
    action: `updated ${contentType}`,
    detail:
      textContent.slice(0, 60) || fileMeta.fileName || entry.fileName || linkUrl,
  });

  if (entry.projectId) revalidatePath(`/app/projects/${entry.projectId}`);
  revalidatePath("/app/feed");
}

export async function deleteEntry(entryId: string) {
  const session = await requireSession();
  const entry = await getOwnedEntry(entryId, session.user.organizationId!);
  if (!entry) throw new Error("Entry not found");

  await prisma.entry.delete({ where: { id: entryId } });
  if (entry.projectId) revalidatePath(`/app/projects/${entry.projectId}`);
  revalidatePath("/app/feed");
}
