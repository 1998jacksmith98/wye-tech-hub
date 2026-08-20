import { NextResponse } from "next/server";
import { hubBaseUrl, requireRevitActor } from "@/lib/revit-auth";

export async function GET(request: Request) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  return NextResponse.json({
    user: {
      id: auth.actor.userId,
      name: auth.actor.userName,
      email: auth.actor.userEmail,
    },
    organization: {
      id: auth.actor.organizationId,
      name: auth.actor.organizationName,
    },
    hubUrl: hubBaseUrl(),
  });
}
