import { StorageConfigError } from "./errors";
import { uploadLocally } from "./local";
import {
  isSharePointAppConfigured,
  uploadToSharePointApp,
} from "./sharepoint-app";
import { uploadToVercelBlob } from "./vercel-blob";
import type {
  StorageProvider,
  StorageStatus,
  StoreUploadParams,
  UploadResult,
} from "./types";

export { StorageConfigError } from "./errors";
export type {
  StorageProvider,
  StorageStatus,
  StoreUploadParams,
  UploadResult,
} from "./types";

function isVercelProduction(): boolean {
  return process.env.VERCEL === "1";
}

export function resolveStorageProvider(): StorageProvider {
  const explicit = process.env.STORAGE_PROVIDER?.trim().toLowerCase();

  if (explicit === "sharepoint") return "sharepoint";
  if (explicit === "local") return "local";
  if (explicit === "vercel_blob") return "vercel_blob";

  if (isVercelProduction()) return "vercel_blob";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel_blob";
  return "local";
}

export function getStorageStatus(): StorageStatus {
  const provider = resolveStorageProvider();
  const onVercel = isVercelProduction();

  if (provider === "sharepoint") {
    const ready = isSharePointAppConfigured();
    return {
      provider,
      label: "SharePoint",
      ready,
      detail: ready
        ? "SharePoint library (application permissions, Sites.Selected)"
        : "Set SHAREPOINT_DRIVE_ID and Microsoft app credentials, then STORAGE_PROVIDER=sharepoint",
    };
  }

  if (provider === "vercel_blob") {
    const ready = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    return {
      provider,
      label: "Vercel Blob",
      ready,
      detail: ready
        ? "Vercel Blob store linked"
        : onVercel
          ? "Link a Blob store in the Vercel project (Storage tab) so BLOB_READ_WRITE_TOKEN is set"
          : "Set BLOB_READ_WRITE_TOKEN or use STORAGE_PROVIDER=local for dev uploads folder",
    };
  }

  return {
    provider: "local",
    label: "Local disk",
    ready: !onVercel,
    detail: onVercel
      ? "Local disk storage cannot run on Vercel — set STORAGE_PROVIDER=vercel_blob or sharepoint"
      : "Dev-only uploads/ folder (not for production)",
  };
}

export async function storeUpload(
  params: StoreUploadParams,
): Promise<UploadResult> {
  const provider = resolveStorageProvider();

  if (provider === "sharepoint") {
    if (!isSharePointAppConfigured()) {
      throw new StorageConfigError(
        "SharePoint storage is not configured. Set SHAREPOINT_DRIVE_ID, AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET, and AUTH_MICROSOFT_ENTRA_ID_ISSUER. IT must grant Sites.Selected access to the Tech Hub library.",
      );
    }
    return uploadToSharePointApp(params);
  }

  if (provider === "vercel_blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new StorageConfigError(
        "Screenshot storage is not configured. On Vercel, open the project Storage tab and create or link a Blob store — that injects BLOB_READ_WRITE_TOKEN automatically. Local dev: copy the token into web/.env or set STORAGE_PROVIDER=local.",
      );
    }
    return uploadToVercelBlob(params);
  }

  if (isVercelProduction()) {
    throw new StorageConfigError(
      "Upload storage is not configured for production. Link Vercel Blob (STORAGE_PROVIDER=vercel_blob) or configure SharePoint (STORAGE_PROVIDER=sharepoint) once IT grants Sites.Selected.",
    );
  }

  return uploadLocally(params);
}
