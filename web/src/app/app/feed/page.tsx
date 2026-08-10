import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { LibraryFeed } from "@/components/library-feed";
import { GENERIC_JOB_LABEL } from "@/lib/constants";

export default async function InformationFeedPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const [entries, projects] = await Promise.all([
    prisma.entry.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { project: { organizationId: orgId } },
        ],
      },
      include: {
        createdBy: true,
        project: {
          select: {
            id: true,
            jobNumber: true,
            jobName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: { id: true, jobNumber: true, jobName: true },
      orderBy: [{ status: "asc" }, { jobNumber: "asc" }],
    }),
  ]);

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Team knowledge
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Information feed
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Search every project note — or add generic tips for Revit quirks,
          families and standards that aren&apos;t tied to one job.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle eyebrow="Library" title="All entries" />
        <LibraryFeed
          projects={projects}
          entries={entries.map((entry) => {
            const isGeneric = !entry.projectId;
            return {
              id: entry.id,
              contentType: entry.contentType,
              textContent: entry.textContent,
              linkUrl: entry.linkUrl,
              fileName: entry.fileName,
              sharePointWebUrl: entry.sharePointWebUrl,
              localFilePath: entry.localFilePath,
              tagsJson: entry.tagsJson,
              createdAt: entry.createdAt,
              createdByName: entry.createdBy?.name || "Someone",
              projectId: entry.project?.id,
              jobNumber: isGeneric
                ? GENERIC_JOB_LABEL
                : entry.project!.jobNumber,
              jobName: isGeneric ? GENERIC_JOB_LABEL : entry.project!.jobName,
              isGeneric,
            };
          })}
        />
      </Card>
    </div>
  );
}
