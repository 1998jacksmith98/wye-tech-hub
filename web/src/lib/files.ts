import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

type UploadResult = {
  fileName: string;
  fileMimeType: string;
  sharePointItemId?: string;
  sharePointWebUrl?: string;
  localFilePath?: string;
};

async function refreshAccessToken(accountId: string, refreshToken: string) {
  const tenant = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "common";
  const body = new URLSearchParams({
    client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "",
    client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await prisma.account.update({
    where: { id: accountId },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    },
  });

  return data.access_token;
}

async function getGraphAccessToken(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "microsoft-entra-id" },
  });
  if (!account?.access_token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 60) {
    return account.access_token;
  }
  if (!account.refresh_token) return account.access_token;
  return refreshAccessToken(account.id, account.refresh_token);
}

async function uploadToSharePoint(
  accessToken: string,
  orgSlug: string,
  projectNumber: string,
  fileName: string,
  bytes: Buffer,
  mimeType: string,
): Promise<{ id: string; webUrl: string } | null> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) return null;

  const safeName = fileName.replace(/[^\w.\- ()]+/g, "_");
  const remotePath = `Tech Hub/${orgSlug}/${projectNumber}/entries/${Date.now()}_${safeName}`;
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeURI(remotePath)}:/content`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType || "application/octet-stream",
    },
    body: new Uint8Array(bytes),
  });

  if (!res.ok) {
    console.error("SharePoint upload failed", await res.text());
    return null;
  }

  const data = (await res.json()) as { id: string; webUrl: string };
  return { id: data.id, webUrl: data.webUrl };
}

async function saveLocally(
  orgSlug: string,
  projectNumber: string,
  fileName: string,
  bytes: Buffer,
): Promise<string> {
  const safeName = fileName.replace(/[^\w.\- ()]+/g, "_");
  const dir = path.join(
    process.cwd(),
    "uploads",
    orgSlug,
    projectNumber,
    "entries",
  );
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, `${Date.now()}_${safeName}`);
  await writeFile(full, bytes);
  return full;
}

export async function storeUpload(params: {
  userId: string;
  orgSlug: string;
  projectNumber: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<UploadResult> {
  const token = await getGraphAccessToken(params.userId);
  if (token && process.env.SHAREPOINT_DRIVE_ID) {
    const sp = await uploadToSharePoint(
      token,
      params.orgSlug,
      params.projectNumber,
      params.fileName,
      params.bytes,
      params.mimeType,
    );
    if (sp) {
      return {
        fileName: params.fileName,
        fileMimeType: params.mimeType,
        sharePointItemId: sp.id,
        sharePointWebUrl: sp.webUrl,
      };
    }
  }

  const localFilePath = await saveLocally(
    params.orgSlug,
    params.projectNumber,
    params.fileName,
    params.bytes,
  );

  return {
    fileName: params.fileName,
    fileMimeType: params.mimeType,
    localFilePath,
  };
}
