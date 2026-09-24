import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRevitActor } from "@/lib/revit-auth";
import { guideKind } from "@/lib/guides";

export async function GET(request: Request) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const guides = await prisma.guide.findMany({
    where: { organizationId: auth.actor.organizationId },
    include: { createdBy: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    guides: guides.map((guide) => ({
      id: guide.id,
      title: guide.title,
      summary: guide.summary,
      category: guide.category,
      keywords: guide.keywords,
      fileName: guide.fileName,
      fileType: guideKind(guide.fileName),
      createdByName: guide.createdBy?.name || "Someone",
    })),
  });
}
