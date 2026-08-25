export type StorageProvider = "vercel_blob" | "sharepoint" | "local";

/** Result mapped onto existing Prisma file columns (sharePoint* / localFilePath). */
export type UploadResult = {
  fileName: string;
  fileMimeType: string;
  sharePointItemId?: string;
  sharePointWebUrl?: string;
  localFilePath?: string;
};

export type StoreUploadParams = {
  /** Not used for blob or SharePoint application-permission uploads. */
  userId?: string;
  orgSlug: string;
  projectNumber: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

export type StorageStatus = {
  provider: StorageProvider;
  label: string;
  ready: boolean;
  detail: string;
};
