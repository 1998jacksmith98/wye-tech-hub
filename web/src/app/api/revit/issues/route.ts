import { NextResponse } from "next/server";
import { jsonError, requireRevitActor } from "@/lib/revit-auth";
import { addRevitIssue } from "@/lib/revit-jobs";

export async function POST(request: Request) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    workaround?: string;
    category?: string;
    keywords?: string;
    status?: string;
    revitVersion?: string;
    screenshotBase64?: string;
    screenshotFileName?: string;
  };

  try {
    await addRevitIssue(auth.actor, null, { ...body, linkToJob: false });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Could not add technical issue.",
    );
  }

  return NextResponse.json({ ok: true });
}
