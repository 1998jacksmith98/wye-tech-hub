"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { generateRevitToken, hashRevitToken } from "@/lib/revit-auth";

export async function createRevitToken(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") || "Revit").trim() || "Revit";
  const token = generateRevitToken();

  await prisma.revitApiToken.create({
    data: {
      userId: session.user.id,
      name,
      tokenHash: hashRevitToken(token),
      prefix: token.slice(0, 12),
    },
  });

  revalidatePath("/app/admin");
  return token;
}

export async function revokeRevitToken(tokenId: string) {
  const session = await requireSession();
  await prisma.revitApiToken.deleteMany({
    where: { id: tokenId, userId: session.user.id },
  });
  revalidatePath("/app/admin");
}
