import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

type GuideFile = {
  fileName: string;
  fileMimeType: string | null;
  sharePointWebUrl: string | null;
  localFilePath: string | null;
};

export async function guideFileResponse(guide: GuideFile) {
  const headers = {
    "Content-Type": guide.fileMimeType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${guide.fileName.replace(/"/g, "")}"`,
  };

  if (guide.sharePointWebUrl) {
    const upstream = await fetch(guide.sharePointWebUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Could not open the file" }, { status: 502 });
    }
    return new NextResponse(upstream.body, { headers });
  }

  if (!guide.localFilePath) {
    return NextResponse.json({ error: "No file" }, { status: 404 });
  }

  const resolved = path.resolve(guide.localFilePath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const bytes = await readFile(resolved);
  return new NextResponse(bytes, { headers });
}
