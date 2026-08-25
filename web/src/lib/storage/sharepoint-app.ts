/**
 * Phase 2 — SharePoint uploads via application permissions (client credentials).
 * Requires Sites.Selected admin consent and explicit site grant — not delegated user tokens.
 */
import type { StoreUploadParams, UploadResult } from "./types";
import { sharePointRemotePath } from "./paths";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isSharePointAppConfigured() {
  return Boolean(
    process.env.SHAREPOINT_DRIVE_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  );
}

async function getAppAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const tenant = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!;
  const body = new URLSearchParams({
    client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
    client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Microsoft app token request failed (${res.status}): ${detail}`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

export async function uploadToSharePointApp(
  params: StoreUploadParams,
): Promise<UploadResult> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID!;
  const remotePath = sharePointRemotePath(
    params.orgSlug,
    params.projectNumber,
    params.fileName,
  );
  const accessToken = await getAppAccessToken();
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeURI(remotePath)}:/content`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": params.mimeType || "application/octet-stream",
    },
    body: new Uint8Array(params.bytes),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`SharePoint upload failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { id: string; webUrl: string };

  return {
    fileName: params.fileName,
    fileMimeType: params.mimeType,
    sharePointItemId: data.id,
    sharePointWebUrl: data.webUrl,
  };
}
