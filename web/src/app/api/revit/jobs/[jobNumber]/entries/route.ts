import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import {
  addJobEntry,
  findProjectByJobNumber,
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

  const body = (await request.json().catch(() => ({}))) as {
    contentType?: string;
    textContent?: string;
    linkUrl?: string;
    source?: string;
    topic?: string;
    status?: string;
    person?: string;
    screenshotBase64?: string;
    screenshotFileName?: string;
    viewName?: string;
  };

  try {
    await addJobEntry(auth.actor, project.id, body);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not add entry.");
  }

  const updated = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  return NextResponse.json({ ok: true, job: updated ? serializeJob(updated) : null });
}
