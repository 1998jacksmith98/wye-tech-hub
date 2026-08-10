import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createProject } from "@/lib/actions/projects";
import { Card, SectionTitle } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const session = await requireSession();
  const members = await prisma.user.findMany({
    where: {
      memberships: { some: { organizationId: session.user.organizationId! } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <Card className="fade-up mx-auto max-w-3xl p-8">
      <SectionTitle eyebrow="Create" title="New project" />
      <ProjectForm
        action={createProject}
        members={members}
        submitLabel="Create project"
      />
    </Card>
  );
}
