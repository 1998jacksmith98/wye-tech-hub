import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = await params;
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.sharePointWebUrl) {
    return NextResponse.redirect(entry.sharePointWebUrl);
  }

  if (!entry.localFilePath) {
    return NextResponse.json({ error: "No file" }, { status: 404 });
  }

  const resolved = path.resolve(entry.localFilePath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const bytes = await readFile(resolved);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": entry.fileMimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${entry.fileName || "file"}"`,
    },
  });
}
