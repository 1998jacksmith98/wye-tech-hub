import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";

export default async function ProjectsHome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status = "Active" } = await searchParams;
  const orgId = session.user.organizationId!;

  const projects = await prisma.project.findMany({
    where: {
      organizationId: orgId,
      ...(status !== "All" ? { status } : {}),
    },
    include: {
      assignments: { include: { user: true } },
      checklist: { where: { isComplete: false } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activity = await prisma.activity.findMany({
    where: { organizationId: orgId },
    include: {
      user: true,
      project: true,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const filters = ["Active", "Archived", "All"] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section className="fade-up">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Team workspace
            </p>
            <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
              Projects
            </h1>
          </div>
          <Link href="/app/projects/new">
            <Button>+ New project</Button>
          </Link>
        </div>

        <div className="mb-5 flex gap-2">
          {filters.map((f) => (
            <Link
              key={f}
              href={f === "Active" ? "/app" : `/app?status=${f}`}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                status === f
                  ? "bg-bg-deep !text-[#ffffff]"
                  : "bg-white text-ink-soft hover:text-ink"
              }`}
            >
              {f}
            </Link>
          ))}
        </div>

        {projects.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="display text-xl font-semibold">No projects yet</p>
            <p className="mt-2 text-ink-soft">
              Create a project and assign technicians to get started.
            </p>
            <Link href="/app/projects/new" className="mt-6 inline-block">
              <Button>Create first project</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Link key={project.id} href={`/app/projects/${project.id}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                        {project.jobNumber}
                      </p>
                      <h2 className="display mt-1 text-xl font-semibold leading-tight">
                        {project.jobName}
                      </h2>
                    </div>
                    <Badge tone={project.status === "Active" ? "success" : "default"}>
                      {project.status}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-ink-soft">
                    {project.leadEngineer ? (
                      <p>Engineer: {project.leadEngineer}</p>
                    ) : null}
                    {project.nextIssueDate ? (
                      <p className="font-semibold text-warning">
                        Next issue: {project.nextIssueDate}
                      </p>
                    ) : null}
                    {project.checklist.length > 0 ? (
                      <p className="font-semibold text-accent-deep">
                        {project.checklist.length} open action
                        {project.checklist.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                    <div className="flex flex-wrap gap-1.5">
                      {project.assignments.slice(0, 4).map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-deep"
                        >
                          {a.user.name?.split(" ")[0] || a.user.email}
                        </span>
                      ))}
                      {project.assignments.length === 0 ? (
                        <span className="text-xs text-ink-muted">Unassigned</span>
                      ) : null}
                    </div>
                    <span className="text-xs text-ink-muted">
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <aside className="fade-up-delay">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Live activity
          </p>
          <div className="mt-4 space-y-4">
            {activity.length === 0 ? (
              <p className="text-sm text-ink-muted">No activity yet.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="border-b border-line pb-3 last:border-0">
                  <p className="text-sm text-ink">
                    <span className="font-semibold">
                      {item.user?.name?.split(" ")[0] || "Someone"}
                    </span>{" "}
                    {item.action}
                  </p>
                  {item.project ? (
                    <p className="mt-0.5 text-xs font-semibold text-accent">
                      {item.project.jobName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
