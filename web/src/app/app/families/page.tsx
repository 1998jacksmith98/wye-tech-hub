import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { FamilyLibrary } from "@/components/family-library";

export default async function FamiliesPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const [families, projects] = await Promise.all([
    prisma.family.findMany({
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
          Revit library
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Families
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Shared catalogue of custom families. Store the network path to the
          .rfa (not the file itself) plus preview images, and optionally link
          a family to a Tech Hub project so it shows on that job&apos;s
          information feed.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle
          eyebrow="Catalogue"
          title={`${families.length} famil${families.length === 1 ? "y" : "ies"}`}
        />
        <FamilyLibrary
          projects={projects}
          families={families.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            category: f.category,
            materials: f.materials,
            keywords: f.keywords,
            filePath: f.filePath,
            jobNumber: f.jobNumber,
            jobName: f.jobName,
            projectId: f.projectId,
            revitVersion: f.revitVersion,
            createdByName: f.createdBy?.name || "Someone",
            createdAt: f.createdAt,
            images: f.images.map((img) => ({
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
