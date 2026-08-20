import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import { findProjectByJobNumber, serializeJob } from "@/lib/revit-jobs";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobNumber: string }> },
) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const { jobNumber } = await context.params;
  const project = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  if (!project) {
    return jsonError(
      `No Tech Hub job found for ${decodeURIComponent(jobNumber)}. Create the tile on the weekly board first.`,
      404,
    );
  }

  return NextResponse.json({ job: serializeJob(project) });
}
