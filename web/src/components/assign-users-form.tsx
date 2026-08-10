"use client";

import { useState, useTransition } from "react";
import { setProjectAssignments } from "@/lib/actions/projects";
import { Button } from "@/components/ui";

type Member = { id: string; name: string | null; email: string | null };

export function AssignUsersForm({
  projectId,
  members,
  assignedIds,
}: {
  projectId: string;
  members: Member[];
  assignedIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(assignedIds);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => {
          const checked = selected.includes(m.id);
          return (
            <label
              key={m.id}
              className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  setSelected((prev) =>
                    checked ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                  );
                }}
              />
              {m.name || m.email}
            </label>
          );
        })}
      </div>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          start(async () => {
            await setProjectAssignments(projectId, selected);
          });
        }}
      >
        Save assignees
      </Button>
    </div>
  );
}
