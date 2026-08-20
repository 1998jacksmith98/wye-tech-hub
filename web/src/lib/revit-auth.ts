import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type RevitActor = {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  tokenId: string;
};

export function hashRevitToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRevitToken() {
  return `wyth_${randomBytes(32).toString("hex")}`;
}

export async function requireRevitActor(request: Request): Promise<
  { actor: RevitActor } | { error: NextResponse }
> {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (!token || !token.startsWith("wyth_")) {
    return {
      error: NextResponse.json(
        { error: "Missing Revit token. Open Tech Hub → Revit and create one." },
        { status: 401 },
      ),
    };
  }

  const tokenHash = hashRevitToken(token);
  const row = await prisma.revitApiToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          memberships: { include: { organization: true }, take: 1 },
        },
      },
    },
  });

  const membership = row?.user.memberships[0];
  if (!row || !membership) {
    return {
      error: NextResponse.json(
        { error: "Invalid or revoked Revit token." },
        { status: 401 },
      ),
    };
  }

  await prisma.revitApiToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    actor: {
      userId: row.user.id,
      userName: row.user.name,
      userEmail: row.user.email,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      tokenId: row.id,
    },
  };
}

export function hubBaseUrl() {
  return (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
