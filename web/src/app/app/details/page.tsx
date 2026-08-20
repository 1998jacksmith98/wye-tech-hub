import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { DetailLibrary } from "@/components/detail-library";

export default async function DetailsPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const [details, projects] = await Promise.all([
    prisma.typicalDetail.findMany({
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
          Typical details
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Details
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Shared catalogue of typical details drawn on jobs. Store the network
          path (not the file itself) plus preview screenshots, and link each
          detail to a Tech Hub project so it stays findable from the job and
          the information feed.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle
          eyebrow="Catalogue"
          title={`${details.length} detail${details.length === 1 ? "" : "s"}`}
        />
        <DetailLibrary
          projects={projects}
          details={details.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            category: d.category,
            materials: d.materials,
            keywords: d.keywords,
            filePath: d.filePath,
            jobNumber: d.jobNumber,
            jobName: d.jobName,
            projectId: d.projectId,
            drawnIn: d.drawnIn,
            createdByName: d.createdBy?.name || "Someone",
            createdAt: d.createdAt,
            images: d.images.map((img) => ({
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
