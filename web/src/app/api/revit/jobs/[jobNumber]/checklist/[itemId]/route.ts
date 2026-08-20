import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import {
  findProjectByJobNumber,
  serializeJob,
  toggleJobChecklistItem,
} from "@/lib/revit-jobs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobNumber: string; itemId: string }> },
) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const { jobNumber, itemId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    isComplete?: boolean;
  };

  try {
    await toggleJobChecklistItem(
      auth.actor,
      itemId,
      Boolean(body.isComplete),
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not update item.");
  }

  const updated = await findProjectByJobNumber(
    auth.actor.organizationId,
    decodeURIComponent(jobNumber),
  );
  return NextResponse.json({ job: updated ? serializeJob(updated) : null });
}
