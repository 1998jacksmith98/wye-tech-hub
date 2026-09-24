import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guideFileResponse } from "@/lib/guide-file";

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

  return guideFileResponse(guide);
}
