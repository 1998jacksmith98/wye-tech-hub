import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRevitActor } from "@/lib/revit-auth";
import { guideFileResponse } from "@/lib/guide-file";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guideId: string }> },
) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const { guideId } = await params;
  const guide = await prisma.guide.findFirst({
    where: { id: guideId, organizationId: auth.actor.organizationId },
  });
  if (!guide) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return guideFileResponse(guide);
}
