import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import {
  findProjectByJobNumber,
  serializeJob,
  setJobDeadlineComplete,
} from "@/lib/revit-jobs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobNumber: string; deadlineId: string }> },
) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const { jobNumber, deadlineId } = await context.params;
  const project = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  if (!project) return jsonError("Job not found on Tech Hub.", 404);

  const body = (await request.json().catch(() => ({}))) as {
    isComplete?: boolean;
  };

  try {
    await setJobDeadlineComplete(
      auth.actor,
      project.id,
      deadlineId,
      Boolean(body.isComplete),
    );
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Could not update the issue date.",
    );
  }

  const updated = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  return NextResponse.json({ job: updated ? serializeJob(updated) : null });
}
