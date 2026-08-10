import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { TeamManager } from "@/components/team-manager";

export default async function TeamPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          People
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Add technicians here so you can assign them to projects, weekly tiles
          and deadlines — even before they&apos;ve signed in themselves.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle
          eyebrow="Directory"
          title={`${memberships.length} member${memberships.length === 1 ? "" : "s"}`}
        />
        <TeamManager
          members={memberships.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            isYou: m.user.id === session.user.id,
          }))}
        />
      </Card>
    </div>
  );
}
