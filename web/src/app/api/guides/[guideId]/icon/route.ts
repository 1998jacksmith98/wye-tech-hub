import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { guideId } = await params;
  const guide = await prisma.guide.findFirst({
    where: { id: guideId, organizationId: session.user.organizationId },
  });
  if (!guide) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (guide.iconSharePointWebUrl) {
    return NextResponse.redirect(guide.iconSharePointWebUrl);
  }

  if (!guide.iconLocalFilePath) {
    return NextResponse.json({ error: "No picture" }, { status: 404 });
  }

  const resolved = path.resolve(guide.iconLocalFilePath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const bytes = await readFile(resolved);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": guide.iconMimeType || "image/png",
      "Content-Disposition": `inline; filename="${guide.iconFileName || "icon"}"`,
    },
  });
}
