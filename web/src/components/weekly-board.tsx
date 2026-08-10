"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  createBoardColumn,
  createBoardTile,
  deleteBoardColumn,
  moveProjectOnBoard,
  renameBoardColumn,
} from "@/lib/actions/board";
import { initials } from "@/lib/board";
import { Button, Input } from "@/components/ui";
import {
  DeadlineManager,
  type DeadlineData,
} from "@/components/deadline-manager";

export type BoardCard = {
  id: string;
  jobNumber: string;
  jobName: string;
  nextIssueDate: string;
  openActions: number;
  assignees: { id: string; name: string | null; email: string | null }[];
  deadlines: DeadlineData[];
};

export type BoardColumnData = {
  id: string;
  name: string;
  cards: BoardCard[];
};

type Member = { id: string; name: string | null; email: string | null };

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

export function WeeklyBoard({
  columns,
  members,
}: {
  columns: BoardColumnData[];
  members: Member[];
}) {
  const [board, setBoard] = useState(columns);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [addingCardColumnId, setAddingCardColumnId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [menuColumnId, setMenuColumnId] = useState<string | null>(null);
  const [deadlinesCardId, setDeadlinesCardId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    setBoard(columns);
  }, [columns]);

  function findCard(projectId: string) {
    for (const col of board) {
      const index = col.cards.findIndex((c) => c.id === projectId);
      if (index >= 0) return { columnId: col.id, index, card: col.cards[index] };
    }
    return null;
  }

  function optimisticMove(projectId: string, toColumnId: string, toIndex: number) {
    setBoard((prev) => {
      const next = prev.map((col) => ({ ...col, cards: [...col.cards] }));
      let moving: BoardCard | null = null;
      for (const col of next) {
        const idx = col.cards.findIndex((c) => c.id === projectId);
        if (idx >= 0) {
          [moving] = col.cards.splice(idx, 1);
          break;
        }
      }
      if (!moving) return prev;
      const target = next.find((c) => c.id === toColumnId);
      if (!target) return prev;
      target.cards.splice(Math.max(0, Math.min(toIndex, target.cards.length)), 0, moving);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.map((column) => (
          <section
            key={column.id}
            className={`flex w-[300px] shrink-0 flex-col rounded-2xl border bg-[#edf2f6]/90 ${
              overColumnId === column.id && draggingId
                ? "border-accent shadow-[var(--shadow)]"
                : "border-line"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumnId(column.id);
            }}
            onDragLeave={() => {
              if (overColumnId === column.id) setOverColumnId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const projectId = e.dataTransfer.getData("text/project-id") || draggingId;
              setOverColumnId(null);
              setDraggingId(null);
              if (!projectId) return;
              const from = findCard(projectId);
              if (!from) return;
              const toIndex = column.cards.length;
              if (from.columnId === column.id && from.index === toIndex) return;
              optimisticMove(projectId, column.id, toIndex);
              start(async () => {
                await moveProjectOnBoard(projectId, column.id, toIndex);
              });
            }}
          >
            <header className="relative flex items-start justify-between gap-2 px-3 py-3">
              {editingColumnId === column.id ? (
                <form
                  className="flex w-full flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError("");
                    start(async () => {
                      try {
                        await renameBoardColumn(column.id, editName);
                        setEditingColumnId(null);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Could not rename column",
                        );
                      }
                    });
                  }}
                >
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending} className="!py-1.5">
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="!py-1.5"
                      onClick={() => setEditingColumnId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <h2 className="display text-sm font-semibold leading-snug text-ink">
                      {column.name}
                    </h2>
                    <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">
                      {column.cards.length}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-sm font-bold text-ink-muted hover:bg-white hover:text-ink"
                      aria-label="Column options"
                      onClick={() =>
                        setMenuColumnId((id) =>
                          id === column.id ? null : column.id,
                        )
                      }
                    >
                      ···
                    </button>
                    {menuColumnId === column.id ? (
                      <div className="absolute right-0 z-10 mt-1 w-36 rounded-xl border border-line bg-white p-1 shadow-[var(--shadow)]">
                        <button
                          type="button"
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-bg"
                          onClick={() => {
                            setEditName(column.name);
                            setEditingColumnId(column.id);
                            setMenuColumnId(null);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger/10"
                          onClick={() => {
                            setMenuColumnId(null);
                            if (board.length <= 1) {
                              setError("You need at least one column.");
                              return;
                            }
                            const msg =
                              column.cards.length > 0
                                ? `Delete "${column.name}"? Its ${column.cards.length} tile(s) will move to another column.`
                                : `Delete "${column.name}"?`;
                            if (!confirm(msg)) return;
                            setError("");
                            start(async () => {
                              try {
                                await deleteBoardColumn(column.id);
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not delete column",
                                );
                              }
                            });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </header>

            <div className="flex flex-1 flex-col gap-2 px-3 pb-3">
              {column.cards.map((card, cardIndex) => (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(card.id);
                    e.dataTransfer.setData("text/project-id", card.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumnId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOverColumnId(column.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectId =
                      e.dataTransfer.getData("text/project-id") || draggingId;
                    setOverColumnId(null);
                    setDraggingId(null);
                    if (!projectId) return;
                    optimisticMove(projectId, column.id, cardIndex);
                    start(async () => {
                      await moveProjectOnBoard(projectId, column.id, cardIndex);
                    });
                  }}
                  className={`rounded-xl border border-line bg-white p-3 shadow-sm transition ${
                    draggingId === card.id ? "opacity-50" : "hover:border-accent/40"
                  }`}
                >
                  <Link href={`/app/projects/${card.id}`} className="block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                      {card.jobNumber}
                    </p>
                    <p className="display mt-1 text-[15px] font-semibold leading-snug text-ink">
                      {card.jobName}
                    </p>
                  </Link>

                  <div className="mt-3 space-y-1.5">
                    {card.deadlines.length === 0 ? (
                      <span className="text-[11px] font-semibold text-ink-muted">
                        No deadlines yet
                      </span>
                    ) : (
                      card.deadlines.map((deadline) => (
                        <div
                          key={deadline.id}
                          className="flex items-center justify-between gap-2 rounded-md bg-warning/10 px-2 py-1"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                              {deadline.label}
                            </p>
                            <p className="text-[11px] font-semibold text-warning">
                              {deadline.date || "No date"}
                            </p>
                          </div>
                          <div className="flex shrink-0 -space-x-1">
                            {deadline.assignees.length === 0 ? (
                              <span className="text-[10px] text-ink-muted">—</span>
                            ) : (
                              deadline.assignees.slice(0, 3).map((person) => (
                                <span
                                  key={person.id}
                                  title={person.name || person.email || ""}
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white text-[8px] font-bold !text-[#ffffff] ${avatarColor(person.id)}`}
                                >
                                  {initials(person.name, person.email)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-accent hover:text-accent-deep"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeadlinesCardId((id) =>
                          id === card.id ? null : card.id,
                        );
                      }}
                    >
                      {deadlinesCardId === card.id ? "Hide dates" : "Dates"}
                    </button>
                    <div className="flex items-center gap-2">
                      {card.openActions > 0 ? (
                        <span className="text-[11px] font-semibold text-accent-deep">
                          {card.openActions} open
                        </span>
                      ) : null}
                      <div className="flex -space-x-1.5">
                        {card.assignees.slice(0, 3).map((person) => (
                          <span
                            key={person.id}
                            title={`On project: ${person.name || person.email || ""}`}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold !text-[#ffffff] ${avatarColor(person.id)}`}
                          >
                            {initials(person.name, person.email)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {deadlinesCardId === card.id ? (
                    <div
                      className="mt-3"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DeadlineManager
                        projectId={card.id}
                        deadlines={card.deadlines}
                        members={members}
                        onClose={() => setDeadlinesCardId(null)}
                      />
                    </div>
                  ) : null}
                </article>
              ))}

              {addingCardColumnId === column.id ? (
                <form
                  className="space-y-2 rounded-xl border border-accent/30 bg-white p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    fd.set("columnId", column.id);
                    start(async () => {
                      await createBoardTile(fd);
                      form.reset();
                      setAddingCardColumnId(null);
                    });
                  }}
                >
                  <Input name="jobNumber" required placeholder="Job number" />
                  <Input name="jobName" required placeholder="Project name" />
                  <Input name="nextIssueDate" placeholder="Due date (DD/MM/YYYY)" />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending} className="!py-2">
                      Add tile
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="!py-2"
                      onClick={() => setAddingCardColumnId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCardColumnId(column.id)}
                  className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-soft hover:bg-white hover:text-ink"
                >
                  + Add a card
                </button>
              )}
            </div>
          </section>
        ))}

        <div className="w-[280px] shrink-0">
          {addingColumn ? (
            <form
              className="space-y-2 rounded-2xl border border-line bg-[#edf2f6]/90 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                start(async () => {
                  try {
                    await createBoardColumn(newColumnName);
                    setNewColumnName("");
                    setAddingColumn(false);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not add column",
                    );
                  }
                });
              }}
            >
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Column name"
                autoFocus
                required
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending} className="!py-2">
                  Add column
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="!py-2"
                  onClick={() => {
                    setAddingColumn(false);
                    setNewColumnName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="flex h-12 w-full items-center rounded-2xl border border-dashed border-line bg-white/50 px-4 text-sm font-semibold text-ink-soft hover:border-accent hover:text-ink"
            >
              + Add another column
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
