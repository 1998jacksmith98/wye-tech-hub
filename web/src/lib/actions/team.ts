"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
}

async function uniquePlaceholderEmail(name: string) {
  const base = slugifyName(name) || "member";
  let email = `${base}@pending.local`;
  let i = 2;
  while (await prisma.user.findUnique({ where: { email } })) {
    email = `${base}${i}@pending.local`;
    i += 1;
  }
  return email;
}

export async function addTeamMember(formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;
  const name = String(formData.get("name") || "").trim();
  let email = String(formData.get("email") || "").trim().toLowerCase();

  if (!name) throw new Error("Name is required.");

  if (!email) {
    email = await uniquePlaceholderEmail(name);
  } else {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: existing.id,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          userId: existing.id,
          role: "member",
        },
      });
      if (!existing.name) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      revalidatePath("/app/team");
      revalidatePath("/app/weekly");
      revalidatePath("/app");
      return;
    }
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      memberships: {
        create: {
          organizationId: orgId,
          role: "member",
        },
      },
    },
  });

  revalidatePath("/app/team");
  revalidatePath("/app/weekly");
  revalidatePath("/app");
  revalidatePath(`/app/projects/new`);
  return user.id;
}

export async function updateTeamMember(userId: string, formData: FormData) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
  });
  if (!membership) throw new Error("Team member not found.");

  const name = String(formData.get("name") || "").trim();
  const emailRaw = String(formData.get("email") || "").trim().toLowerCase();
  if (!name) throw new Error("Name is required.");

  if (emailRaw) {
    const clash = await prisma.user.findFirst({
      where: { email: emailRaw, NOT: { id: userId } },
    });
    if (clash) throw new Error("That email is already used by someone else.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      ...(emailRaw ? { email: emailRaw } : {}),
    },
  });

  revalidatePath("/app/team");
  revalidatePath("/app/weekly");
  revalidatePath("/app");
}

export async function removeTeamMember(userId: string) {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  if (userId === session.user.id) {
    throw new Error("You can't remove yourself.");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
  });
  if (!membership) throw new Error("Team member not found.");

  await prisma.membership.delete({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
  });

  // Clear project-level assignment links so they disappear from tiles
  await prisma.projectAssignment.deleteMany({
    where: {
      userId,
      project: { organizationId: orgId },
    },
  });
  await prisma.deadlineAssignment.deleteMany({
    where: {
      userId,
      deadline: { project: { organizationId: orgId } },
    },
  });

  revalidatePath("/app/team");
  revalidatePath("/app/weekly");
  revalidatePath("/app");
}
