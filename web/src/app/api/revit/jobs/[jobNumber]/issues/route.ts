import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import {
  addRevitIssue,
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
    name?: string;
    description?: string;
    workaround?: string;
    category?: string;
    keywords?: string;
    status?: string;
    revitVersion?: string;
    linkToJob?: boolean;
    screenshotBase64?: string;
    screenshotFileName?: string;
  };

  try {
    await addRevitIssue(auth.actor, project, body);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Could not add technical issue.",
    );
  }

  const updated = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  return NextResponse.json({
    ok: true,
    job: updated ? serializeJob(updated) : null,
  });
}
