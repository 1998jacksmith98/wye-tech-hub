"use client";

import { useState, useTransition } from "react";
import {
  deleteChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
} from "@/lib/actions/projects";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string | null; email: string | null };

export function ChecklistToggle({
  itemId,
  isComplete,
}: {
  itemId: string;
  isComplete: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      checked={isComplete}
      disabled={pending}
      className="h-4 w-4 accent-[var(--accent)]"
      onChange={(e) => {
        start(async () => {
          await toggleChecklistItem(itemId, e.target.checked);
        });
      }}
    />
  );
}

export function ChecklistItemRow({
  item,
  members,
}: {
  item: {
    id: string;
    text: string;
    isComplete: boolean;
    assignedToId: string | null;
    assignedToName: string;
    createdByName: string;
    completedByName: string;
  };
  members: Member[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <form
        className="grid gap-3 rounded-xl border border-accent/30 bg-white px-3 py-3 md:grid-cols-[1fr_220px_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            await updateChecklistItem(item.id, fd);
            setEditing(false);
          });
        }}
      >
        <Input name="text" required defaultValue={item.text} />
        <Select name="assignedToId" defaultValue={item.assignedToId || ""}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.email}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={pending} className="!py-2">
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className="!py-2"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-3 py-3">
      <ChecklistToggle itemId={item.id} isComplete={item.isComplete} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            item.isComplete && "text-ink-muted line-through",
          )}
        >
          {item.text}
          {item.assignedToName ? `  →  ${item.assignedToName}` : ""}
        </p>
        <p className="text-xs text-ink-muted">
          Added by {item.createdByName}
          {item.completedByName ? ` · Done by ${item.completedByName}` : ""}
        </p>
      </div>
      <button
        type="button"
        className="text-xs font-semibold text-ink-muted hover:text-accent"
        onClick={() => setEditing(true)}
      >
        Edit
      </button>
      <button
        type="button"
        disabled={pending}
        className="text-xs font-semibold text-ink-muted hover:text-danger"
        onClick={() => {
          if (!confirm("Remove this action item?")) return;
          start(async () => {
            await deleteChecklistItem(item.id);
          });
        }}
      >
        Remove
      </button>
    </div>
  );
}
