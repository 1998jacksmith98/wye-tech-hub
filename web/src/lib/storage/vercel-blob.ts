import { put } from "@vercel/blob";
import type { StoreUploadParams, UploadResult } from "./types";
import { blobPathname } from "./paths";

export async function uploadToVercelBlob(
  params: StoreUploadParams,
): Promise<UploadResult> {
  const pathname = blobPathname(
    params.orgSlug,
    params.projectNumber,
    params.fileName,
  );

  const blob = await put(pathname, params.bytes, {
    access: "public",
    contentType: params.mimeType || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return {
    fileName: params.fileName,
    fileMimeType: params.mimeType,
    sharePointItemId: blob.pathname,
    sharePointWebUrl: blob.url,
  };
}
