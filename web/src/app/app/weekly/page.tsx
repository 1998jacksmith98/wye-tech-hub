import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureBoardColumns } from "@/lib/board";
import { ensureProjectDeadlines } from "@/lib/actions/deadlines";
import { WeeklyBoard } from "@/components/weekly-board";

export default async function WeeklyBoardPage() {
  const session = await requireSession();
  const orgId = session.user.organizationId!;

  const columns = await ensureBoardColumns(orgId);

  const projects = await prisma.project.findMany({
    where: {
      organizationId: orgId,
      status: "Active",
    },
    include: {
      assignments: { include: { user: true } },
      checklist: { where: { isComplete: false }, select: { id: true } },
      deadlines: {
        include: {
          assignments: { include: { user: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ boardOrder: "asc" }, { updatedAt: "desc" }],
  });

  // Migrate legacy start/next issue dates into deadline rows once
  await Promise.all(projects.map((p) => ensureProjectDeadlines(p.id)));

  const refreshed = await prisma.project.findMany({
    where: {
      organizationId: orgId,
      status: "Active",
    },
    include: {
      assignments: { include: { user: true } },
      checklist: { where: { isComplete: false }, select: { id: true } },
      deadlines: {
        include: {
          assignments: { include: { user: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ boardOrder: "asc" }, { updatedAt: "desc" }],
  });

  const members = await prisma.user.findMany({
    where: { memberships: { some: { organizationId: orgId } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  function toCard(p: (typeof refreshed)[number]) {
    return {
      id: p.id,
      jobNumber: p.jobNumber,
      jobName: p.jobName,
      nextIssueDate: p.nextIssueDate,
      openActions: p.checklist.length,
      assignees: p.assignments.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      })),
      deadlines: p.deadlines.map((d) => ({
        id: d.id,
        label: d.label,
        date: d.date,
        assignees: d.assignments.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
      })),
    };
  }

  const board = columns.map((column) => ({
    id: column.id,
    name: column.name,
    cards: refreshed.filter((p) => p.boardColumnId === column.id).map(toCard),
  }));

  const orphaned = refreshed.filter(
    (p) => !p.boardColumnId || !columns.some((c) => c.id === p.boardColumnId),
  );
  if (orphaned.length > 0 && board[0]) {
    board[0].cards.push(...orphaned.map(toCard));
  }

  return (
    <div className="fade-up space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Monday meeting
          </p>
          <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
            Weekly board
          </h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Drag tiles between lists. Each tile can have multiple deadlines with
            different staff assigned to each one.
          </p>
        </div>
        <p className="text-xs font-semibold text-ink-muted">
          Tip: click Dates on a tile to manage deadlines
        </p>
      </div>

      <WeeklyBoard columns={board} members={members} />
    </div>
  );
}
