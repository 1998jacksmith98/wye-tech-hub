import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureProjectDeadlines } from "@/lib/actions/deadlines";
import { Card } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";
import type { DeadlineData } from "@/components/deadline-manager";

export default async function CalendarPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const projects = await prisma.project.findMany({
    where: { organizationId: orgId, status: "Active" },
    select: { id: true },
  });
  await Promise.all(projects.map((p) => ensureProjectDeadlines(p.id)));

  const [activeProjects, members] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: orgId, status: "Active" },
      include: {
        deadlines: {
          include: {
            assignments: { include: { user: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { jobNumber: "asc" },
    }),
    prisma.user.findMany({
      where: { memberships: { some: { organizationId: orgId } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const events = activeProjects.flatMap((project) => {
    const allDeadlines: DeadlineData[] = project.deadlines.map((d) => ({
      id: d.id,
      label: d.label,
      date: d.date,
      assignees: d.assignments.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      })),
    }));

    return project.deadlines.map((d) => ({
      deadlineId: d.id,
      projectId: project.id,
      jobNumber: project.jobNumber,
      jobName: project.jobName,
      label: d.label,
      date: d.date,
      assignees: d.assignments.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      })),
      allDeadlines,
    }));
  });

  return (
    <div className="fade-up space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Schedule
        </p>
        <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
          Calendar
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Month view of every project deadline. Click an item to edit dates and
          who&apos;s assigned — changes sync with the weekly board.
        </p>
      </div>

      <Card className="p-4 md:p-6">
        <MonthCalendar events={events} members={members} />
      </Card>
    </div>
  );
}
