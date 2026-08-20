import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import {
  findProjectByJobNumber,
  moveJobColumn,
  serializeJob,
} from "@/lib/revit-jobs";

export async function POST(
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
  if (!project) return jsonError("Job not found on Tech Hub.", 404);

  const body = (await request.json().catch(() => ({}))) as { columnId?: string };
  if (!body.columnId) return jsonError("columnId is required.");

  try {
    await moveJobColumn(auth.actor, project.id, body.columnId);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not move job.");
  }

  const updated = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  return NextResponse.json({ job: updated ? serializeJob(updated) : null });
}
