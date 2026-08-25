import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  addChecklistItem,
  updateMilestone,
  updateProject,
} from "@/lib/actions/projects";
import { Badge, Button, Card, Input, Label, SectionTitle, Select, Textarea } from "@/components/ui";
import { ProjectForm } from "@/components/project-form";
import { AssignUsersForm } from "@/components/assign-users-form";
import { ChecklistItemRow } from "@/components/checklist-controls";
import { EntryFeed } from "@/components/entry-feed";
import { cn } from "@/lib/utils";
import { ensureProjectLibraryFeed } from "@/lib/library-feed";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const orgId = session.user.organizationId!;

  await ensureProjectLibraryFeed({
    organizationId: orgId,
    projectId: id,
  });

  const project = await prisma.project.findFirst({
    where: { id, organizationId: orgId },
    include: {
      assignments: { include: { user: true } },
      milestones: { orderBy: { id: "asc" } },
      checklist: {
        include: {
          assignedTo: true,
          createdBy: true,
          completedBy: true,
        },
        orderBy: [{ isComplete: "asc" }, { createdAt: "desc" }],
      },
      entries: {
        include: { createdBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) notFound();

  const members = await prisma.user.findMany({
    where: {
      memberships: { some: { organizationId: session.user.organizationId! } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/app" className="text-sm font-semibold text-ink-soft hover:text-accent">
            ← All projects
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            {project.jobNumber}
          </p>
          <h1 className="display mt-1 text-3xl font-semibold tracking-tight">
            {project.jobName}
          </h1>
        </div>
        <Badge tone={project.status === "Active" ? "success" : "default"}>
          {project.status}
        </Badge>
      </div>

      <Card className="fade-up p-6">
        <SectionTitle eyebrow="Overview" title="Project info" />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Lead engineer", project.leadEngineer],
            ["Client", project.client],
            ["Architect", project.architect],
            ["Arch software", project.architectSoftware],
            ["Revit version", project.revitVersion],
            ["Start date", project.startDate],
            ["Next issue", project.nextIssueDate],
            ["Created by", project.createdById ? "Team member" : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {label}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  label === "Next issue" && value ? "text-warning" : "text-ink",
                )}
              >
                {value || "—"}
              </p>
            </div>
          ))}
        </div>

        <details className="rounded-xl border border-line bg-white/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
            Edit project info
          </summary>
          <div className="mt-4">
            <ProjectForm
              action={updateProject.bind(null, project.id)}
              members={members}
              values={project}
              submitLabel="Save changes"
            />
          </div>
        </details>
      </Card>

      <Card className="fade-up p-6">
        <SectionTitle eyebrow="Team" title="Assigned technicians" />
        <AssignUsersForm
          projectId={project.id}
          members={members}
          assignedIds={project.assignments.map((a) => a.userId)}
        />
      </Card>

      <Card className="fade-up p-6">
        <SectionTitle eyebrow="Programme" title="Project timeline" />
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          {project.milestones.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-2xl border p-4",
                m.isReached
                  ? "border-accent/40 bg-accent-soft"
                  : "border-line bg-white",
              )}
            >
              <p className="display text-sm font-semibold">{m.stage}</p>
              <p className="mt-2 text-xs text-ink-muted">
                Target: {m.targetDate || "—"}
              </p>
              <p className="text-xs text-ink-muted">
                Confirmed: {m.confirmedDate || "—"}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {project.milestones.map((m) => (
            <form
              key={m.id}
              action={updateMilestone.bind(null, m.id)}
              className="rounded-xl border border-line bg-white/70 p-4"
            >
              <p className="mb-3 text-sm font-semibold">{m.stage}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Target date</Label>
                  <Input name="targetDate" defaultValue={m.targetDate} />
                </div>
                <div>
                  <Label>Confirmed date</Label>
                  <Input name="confirmedDate" defaultValue={m.confirmedDate} />
                </div>
              </div>
              <div className="mt-3">
                <Label>Notes</Label>
                <Textarea name="notes" rows={2} defaultValue={m.notes} />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isReached"
                  defaultChecked={m.isReached}
                />
                Mark as reached
              </label>
              <Button type="submit" variant="ghost" className="mt-3 !py-2">
                Update milestone
              </Button>
            </form>
          ))}
        </div>
      </Card>

      <Card className="fade-up p-6">
        <SectionTitle eyebrow="Actions" title="Checklist" />
        <form
          action={addChecklistItem.bind(null, project.id)}
          className="mb-5 grid gap-3 md:grid-cols-[1fr_220px_auto]"
        >
          <Input name="text" required placeholder="Action item..." />
          <Select name="assignedToId" defaultValue="">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </Select>
          <Button type="submit">Add</Button>
        </form>

        <div className="space-y-2">
          {project.checklist.length === 0 ? (
            <p className="text-sm text-ink-muted">No action items yet.</p>
          ) : (
            project.checklist.map((item) => (
              <ChecklistItemRow
                key={item.id}
                members={members}
                item={{
                  id: item.id,
                  text: item.text,
                  isComplete: item.isComplete,
                  assignedToId: item.assignedToId,
                  assignedToName:
                    item.assignedTo?.name || item.assignedTo?.email || "",
                  createdByName: item.createdBy?.name || "someone",
                  completedByName: item.completedBy?.name || "",
                }}
              />
            ))
          )}
        </div>
      </Card>

      <Card className="fade-up p-6">
        <SectionTitle
          eyebrow="Capture"
          title="Information feed"
        />
        <p className="mb-5 -mt-2 text-sm text-ink-soft">
          Search old notes by keyword, topic, source or status — handy when
          digging out coordination decisions later.
        </p>
        <EntryFeed
          projectId={project.id}
          entries={project.entries.map((entry) => ({
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
          }))}
        />
      </Card>
    </div>
  );
}
