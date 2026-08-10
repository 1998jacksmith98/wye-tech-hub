import { prisma } from "@/lib/prisma";

export async function logActivity(params: {
  organizationId: string;
  projectId?: string | null;
  userId?: string | null;
  action: string;
  detail?: string;
}) {
  return prisma.activity.create({
    data: {
      organizationId: params.organizationId,
      projectId: params.projectId || null,
      userId: params.userId || null,
      action: params.action,
      detail: params.detail || "",
    },
  });
}
