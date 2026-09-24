import { GUIDE_EXTENSIONS } from "@/lib/constants";

const MIME_BY_EXT: Record<string, string> = {
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function guideExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot).toLowerCase();
}

export function isGuideFileName(fileName: string) {
  return (GUIDE_EXTENSIONS as readonly string[]).includes(guideExtension(fileName));
}

export function guideKind(fileName: string) {
  const ext = guideExtension(fileName);
  if (ext === ".doc" || ext === ".docx") return "Word";
  if (ext === ".ppt" || ext === ".pptx") return "PowerPoint";
  return "Document";
}

export function guideMimeType(fileName: string, fallback?: string) {
  return MIME_BY_EXT[guideExtension(fileName)] || fallback || "application/octet-stream";
}

export function isAllowedBlobUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".blob.vercel-storage.com") ||
      host.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
