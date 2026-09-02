import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { IssueLibrary } from "@/components/issue-library";

export default async function TechnicalIssuesPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const [issues, projects] = await Promise.all([
    prisma.technicalIssue.findMany({
      where: { organizationId: orgId },
      include: {
        createdBy: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { organizationId: orgId, status: "Active" },
      select: { id: true, jobNumber: true, jobName: true },
      orderBy: { jobNumber: "asc" },
    }),
  ]);

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Revit knowledge
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Technical issues
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Share Revit problems the team has hit, with screenshots and the
          workaround or fix. Mark each one resolved or needs attention, and
          optionally link it to a job. Every entry also appears on the
          information feed.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle
          eyebrow="Catalogue"
          title={`${issues.length} issue${issues.length === 1 ? "" : "s"}`}
        />
        <IssueLibrary
          projects={projects}
          issues={issues.map((issue) => ({
            id: issue.id,
            name: issue.name,
            description: issue.description,
            workaround: issue.workaround,
            status: issue.status,
            category: issue.category,
            keywords: issue.keywords,
            jobNumber: issue.jobNumber,
            jobName: issue.jobName,
            projectId: issue.projectId,
            revitVersion: issue.revitVersion,
            createdByName: issue.createdBy?.name || "Someone",
            createdAt: issue.createdAt,
            images: issue.images.map((img) => ({
              id: img.id,
              fileName: img.fileName,
              sharePointWebUrl: img.sharePointWebUrl,
              localFilePath: img.localFilePath,
            })),
          }))}
        />
      </Card>
    </div>
  );
}
