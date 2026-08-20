import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui";
import { RevitConnect } from "@/components/revit-connect";

export default async function RevitPage() {
  const session = await requireSession();

  const tokens = await prisma.revitApiToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Revit
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Connect Revit
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Create a personal token, then paste it into the Tech Hub tab in Revit.
          That lets you add notes, screenshots, checklist items and move the
          weekly board without leaving the model.
        </p>
      </div>

      <Card className="p-6">
        <SectionTitle eyebrow="Tokens" title="Your Revit access" />
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
