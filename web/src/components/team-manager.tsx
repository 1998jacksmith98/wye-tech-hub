"use client";

import { useState, useTransition } from "react";
import {
  addTeamMember,
  removeTeamMember,
  updateTeamMember,
} from "@/lib/actions/team";
import { Button, Input, Label } from "@/components/ui";
import { initials } from "@/lib/board";

export type TeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isYou: boolean;
};

const AVATAR_COLORS = [
  "bg-[#1f6f8b]",
  "bg-[#2f7d57]",
  "bg-[#b7791f]",
  "bg-[#5b4b8a]",
  "bg-[#b54545]",
  "bg-[#3d6b8c]",
];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i)) % 97;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function TeamManager({ members }: { members: TeamMember[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="rounded-xl border border-line bg-white/70 p-4">
        {showAdd ? (
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              setError("");
              start(async () => {
                try {
                  await addTeamMember(fd);
                  form.reset();
                  setShowAdd(false);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Could not add member",
                  );
                }
              });
            }}
          >
            <div className="md:col-span-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Add team member
              </p>
              <Button
                type="button"
                variant="ghost"
                className="!py-1.5"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
            </div>
            <div>
              <Label>Name</Label>
              <Input name="name" required placeholder="e.g. Matt" />
            </div>
            <div>
              <Label>Work email (optional)</Label>
              <Input
                name="email"
                type="email"
                placeholder="e.g. matt@webbyates.com"
              />
            </div>
            <p className="md:col-span-2 text-xs text-ink-muted">
              Tip: add their real work email if you can — that way Microsoft
              login later will match this person instead of creating a duplicate.
            </p>
            <div className="md:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Adding..." : "Add to team"}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" onClick={() => setShowAdd(true)}>
            + Add team member
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) =>
          editingId === member.id ? (
            <form
              key={member.id}
              className="grid gap-3 rounded-xl border border-accent/30 bg-white p-4 md:grid-cols-[1fr_1fr_auto_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setError("");
                start(async () => {
                  try {
                    await updateTeamMember(member.id, fd);
                    setEditingId(null);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not update member",
                    );
                  }
                });
              }}
            >
              <div>
                <Label>Name</Label>
                <Input name="name" required defaultValue={member.name || ""} />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  name="email"
                  type="email"
                  defaultValue={
                    member.email?.endsWith("@pending.local")
                      ? ""
                      : member.email || ""
                  }
                  placeholder="Work email"
                />
              </div>
              <Button type="submit" disabled={pending} className="self-end !py-2">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="self-end !py-2"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold !text-[#ffffff] ${avatarColor(member.id)}`}
                >
                  {initials(member.name, member.email)}
                </span>
                <div>
                  <p className="font-semibold text-ink">
                    {member.name || "Unnamed"}
                    {member.isYou ? (
                      <span className="ml-2 text-xs font-semibold text-accent">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {member.email?.endsWith("@pending.local")
                      ? "No work email set yet"
                      : member.email || "No email"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-xs font-semibold text-ink-muted hover:text-accent"
                  onClick={() => setEditingId(member.id)}
                >
                  Edit
                </button>
                {!member.isYou ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-ink-muted hover:text-danger"
                    onClick={() => {
                      if (
                        !confirm(
                          `Remove ${member.name || "this person"} from the team? They'll be unassigned from jobs and deadlines.`,
                        )
                      ) {
                        return;
                      }
                      setError("");
                      start(async () => {
                        try {
                          await removeTeamMember(member.id);
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Could not remove member",
                          );
                        }
                      });
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
