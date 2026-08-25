export function safeFileName(fileName: string) {
  return fileName.replace(/[^\w.\- ()]+/g, "_");
}

export function uploadRemotePath(
  orgSlug: string,
  projectNumber: string,
  fileName: string,
) {
  const safeName = safeFileName(fileName);
  return `${orgSlug}/${projectNumber}/entries/${Date.now()}_${safeName}`;
}

/** SharePoint library path (Phase 2). */
export function sharePointRemotePath(
  orgSlug: string,
  projectNumber: string,
  fileName: string,
) {
  return `Tech Hub/${uploadRemotePath(orgSlug, projectNumber, fileName)}`;
}

/** Vercel Blob pathname (Phase 1). */
export function blobPathname(
  orgSlug: string,
  projectNumber: string,
  fileName: string,
) {
  return `tech-hub/${uploadRemotePath(orgSlug, projectNumber, fileName)}`;
}
