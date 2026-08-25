import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { StoreUploadParams, UploadResult } from "./types";
import { safeFileName } from "./paths";

export async function uploadLocally(
  params: StoreUploadParams,
): Promise<UploadResult> {
  const safeName = safeFileName(params.fileName);
  const dir = path.join(
    process.cwd(),
    "uploads",
    params.orgSlug,
    params.projectNumber,
    "entries",
  );
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, `${Date.now()}_${safeName}`);
  await writeFile(full, params.bytes);

  return {
    fileName: params.fileName,
    fileMimeType: params.mimeType,
    localFilePath: full,
  };
}
