import { NextResponse } from "next/server";
import {
  CONTENT_TYPES,
  TAG_SOURCES,
  TAG_STATUS,
  TAG_TOPICS,
} from "@/lib/constants";
import { requireRevitActor } from "@/lib/revit-auth";
import { listBoardColumns } from "@/lib/revit-jobs";

export async function GET(request: Request) {
  const auth = await requireRevitActor(request);
  if ("error" in auth) return auth.error;

  const columns = await listBoardColumns(auth.actor.organizationId);
  return NextResponse.json({
    contentTypes: CONTENT_TYPES,
    sources: TAG_SOURCES,
    topics: TAG_TOPICS,
    statuses: TAG_STATUS,
    columns,
  });
}
