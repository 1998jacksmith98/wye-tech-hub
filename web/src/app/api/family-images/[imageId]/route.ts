import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageId } = await params;
  const image = await prisma.familyImage.findUnique({
    where: { id: imageId },
    include: { family: true },
  });

  if (!image || image.family.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (image.sharePointWebUrl) {
    return NextResponse.redirect(image.sharePointWebUrl);
  }

  if (!image.localFilePath) {
    return NextResponse.json({ error: "No file" }, { status: 404 });
  }

  const resolved = path.resolve(image.localFilePath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const bytes = await readFile(resolved);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": image.fileMimeType || "image/png",
      "Content-Disposition": `inline; filename="${image.fileName}"`,
    },
  });
}
