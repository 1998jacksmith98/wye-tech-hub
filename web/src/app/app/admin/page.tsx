import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStorageStatus } from "@/lib/storage";
import { Card, SectionTitle } from "@/components/ui";
import { TeamManager } from "@/components/team-manager";
import { RevitConnect } from "@/components/revit-connect";

export default async function AdminPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const tokens = await prisma.revitApiToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const storage = getStorageStatus();

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Workspace
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Admin
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Team directory and Revit connection tokens in one place.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle
          eyebrow="People"
          title={`${memberships.length} member${memberships.length === 1 ? "" : "s"}`}
        />
        <p className="mb-5 text-sm text-ink-soft">
          Add technicians here so you can assign them to projects, weekly tiles
          and deadlines — even before they&apos;ve signed in themselves.
        </p>
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

      <Card className="p-6">
        <SectionTitle eyebrow="Infrastructure" title="Storage" />
        <div className="mt-4 flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              storage.ready
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            }`}
            aria-hidden
          >
            {storage.ready ? "✓" : "✗"}
          </span>
          <div>
            <p className="font-medium text-ink">
              {storage.label}
              {storage.ready ? " ready" : " not configured"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{storage.detail}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle eyebrow="Revit" title="Connect Revit" />
        <p className="mb-4 text-sm text-ink-soft">
          Create a personal token, then paste it into the Tech Hub tab in Revit.
          That lets you add notes, screenshots, checklist items and move the
          weekly board without leaving the model.
        </p>
        <ol className="mb-6 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>Create a token below and copy it once.</li>
          <li>In Revit, open the Tech Hub tab → Settings.</li>
          <li>Paste the Tech Hub website URL and the token.</li>
        </ol>
        <RevitConnect
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            prefix: t.prefix,
            createdAt: t.createdAt.toISOString(),
            lastUsedAt: t.lastUsedAt?.toISOString() || null,
          }))}
        />
      </Card>
    </div>
  );
}
