import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { GuideLibrary } from "@/components/guide-library";

export default async function GuidesPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const guides = await prisma.guide.findMany({
    where: { organizationId: orgId },
    include: { createdBy: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          How-to library
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">Guides</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Word documents and PowerPoint presentations the team has written.
          These sit on their own — they are not tied to a job. Search by title,
          topic, or keyword, then open the file.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle
          eyebrow="Directory"
          title={`${guides.length} guide${guides.length === 1 ? "" : "s"}`}
        />
        <GuideLibrary
          guides={guides.map((guide) => ({
            id: guide.id,
            title: guide.title,
            summary: guide.summary,
            category: guide.category,
            keywords: guide.keywords,
            fileName: guide.fileName,
            iconUrl:
              guide.iconSharePointWebUrl ||
              (guide.iconLocalFilePath ? `/api/guides/${guide.id}/icon` : null),
            createdByName: guide.createdBy?.name || "Someone",
            createdAt: guide.createdAt,
          }))}
        />
      </Card>
    </div>
  );
}
