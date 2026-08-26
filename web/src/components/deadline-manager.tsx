"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addProjectDeadline,
  deleteProjectDeadline,
  updateProjectDeadline,
} from "@/lib/actions/deadlines";
import { Button, Input, Label } from "@/components/ui";
import { initials } from "@/lib/board";

export type DeadlineData = {
  id: string;
  label: string;
  date: string;
  assignees: { id: string; name: string | null; email: string | null }[];
};

type Member = { id: string; name: string | null; email: string | null };

const LABEL_PRESETS = [
  "Start",
  "Next issue",
  "S3 Issue",
  "S4 Issue",
  "S5 Issue",
  "Out for checking",
  "Complete",
];

export function DeadlineManager({
  projectId,
  deadlines,
  members,
  onClose,
}: {
  projectId: string;
  deadlines: DeadlineData[];
  members: Member[];
  onClose?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  function afterSave() {
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Deadlines
        </p>
        {onClose ? (
          <button
            type="button"
            className="text-xs font-semibold text-ink-muted hover:text-ink"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-2">
        {deadlines.length === 0 && !adding ? (
          <p className="text-sm text-ink-muted">No deadlines yet.</p>
        ) : null}

        {deadlines.map((d) =>
          editingId === d.id ? (
            <DeadlineForm
              key={d.id}
              members={members}
              initial={d}
              pending={pending}
              submitLabel="Save"
              onCancel={() => setEditingId(null)}
              onSubmit={(fd) => {
                setError("");
                start(async () => {
                  try {
                    await updateProjectDeadline(d.id, fd);
                    setEditingId(null);
                    afterSave();
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not update",
                    );
                  }
                });
              }}
            />
          ) : (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg/50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{d.label}</p>
                <p className="text-xs font-semibold text-warning">
                  {d.date || "No date set"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.assignees.length === 0 ? (
                    <span className="text-[11px] text-ink-muted">Unassigned</span>
                  ) : (
                    d.assignees.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-deep"
                      >
                        {a.name || a.email}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-ink-muted hover:text-accent"
                  onClick={() => setEditingId(d.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-ink-muted hover:text-danger"
                  onClick={() => {
                    if (!confirm(`Remove "${d.label}"?`)) return;
                    setError("");
                    start(async () => {
                      try {
                        await deleteProjectDeadline(d.id);
                        afterSave();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not delete",
                        );
                      }
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <DeadlineForm
          members={members}
          pending={pending}
          submitLabel="Add deadline"
          onCancel={() => setAdding(false)}
          onSubmit={(fd) => {
            setError("");
            start(async () => {
              try {
                await addProjectDeadline(projectId, fd);
                setAdding(false);
                afterSave();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not add deadline",
                );
              }
            });
          }}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="!py-2"
          onClick={() => setAdding(true)}
        >
          + Add deadline
        </Button>
      )}
    </div>
  );
}

function DeadlineForm({
  members,
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  members: Member[];
  initial?: DeadlineData;
  pending: boolean;
  submitLabel: string;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    initial?.assignees.map((a) => a.id) || [],
  );
  const [label, setLabel] = useState(initial?.label || "Next issue");

  return (
    <form
      className="space-y-2 rounded-lg border border-accent/30 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        selected.forEach((id) => fd.append("userIds", id));
        onSubmit(fd);
      }}
    >
      <div>
        <Label>Label</Label>
        <Input
          name="label"
          list="deadline-labels"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <datalist id="deadline-labels">
          {LABEL_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div>
        <Label>Date</Label>
        <Input
          name="date"
          placeholder="DD/MM/YYYY"
          defaultValue={initial?.date || ""}
        />
      </div>
      <div>
        <Label>Assign staff</Label>
        <div className="mt-1 grid max-h-36 gap-1 overflow-y-auto sm:grid-cols-2">
          {members.map((m) => {
            const checked = selected.includes(m.id);
            return (
              <label
                key={m.id}
                className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelected((prev) =>
                      checked
                        ? prev.filter((id) => id !== m.id)
                        : [...prev, m.id],
                    );
                  }}
                />
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-bold !text-[#ffffff]">
                  {initials(m.name, m.email)}
                </span>
                {m.name || m.email}
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="!py-2">
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="!py-2"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
