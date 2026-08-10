"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  DeadlineManager,
  type DeadlineData,
} from "@/components/deadline-manager";
import { Button } from "@/components/ui";
import { initials } from "@/lib/board";
import { parseAppDate, toDateKey } from "@/lib/utils";

export type CalendarEvent = {
  deadlineId: string;
  projectId: string;
  jobNumber: string;
  jobName: string;
  label: string;
  date: string;
  assignees: { id: string; name: string | null; email: string | null }[];
  allDeadlines: DeadlineData[];
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

export function MonthCalendar({
  events,
  members,
}: {
  events: CalendarEvent[];
  members: Member[];
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const parsed = parseAppDate(event.date);
      if (!parsed) continue;
      const key = toDateKey(parsed);
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    const match = events.find((e) => e.projectId === selectedProjectId);
    if (!match) return null;
    return match;
  }, [events, selectedProjectId]);

  const undated = useMemo(
    () => events.filter((e) => !parseAppDate(e.date)),
    [events],
  );

  const today = new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-2xl font-semibold tracking-tight">
            {format(cursor, "MMMM yyyy")}
          </h2>
          <p className="text-sm text-ink-soft">
            Same deadlines as the weekly board — edit either place and both stay
            in sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            className="!py-2"
            onClick={() => setCursor(subMonths(cursor, 1))}
          >
            ← Prev
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!py-2"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="!py-2"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            Next →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDayKey === key;

          return (
            <div
              key={key}
              className={`min-h-[120px] rounded-xl border p-2 ${
                inMonth
                  ? "border-line bg-white"
                  : "border-transparent bg-bg/40 text-ink-muted"
              } ${isToday ? "ring-2 ring-accent/40" : ""} ${
                isSelected ? "border-accent" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    isToday ? "text-accent" : "text-ink-soft"
                  }`}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">
                    {dayEvents.length}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.deadlineId}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(event.projectId);
                      setSelectedDayKey(key);
                    }}
                    className="w-full rounded-lg bg-warning/15 px-1.5 py-1 text-left hover:bg-warning/25"
                  >
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {event.label}
                    </p>
                    <p className="truncate text-[11px] font-semibold text-ink">
                      {event.jobNumber}
                    </p>
                    <div className="mt-0.5 flex -space-x-1">
                      {event.assignees.slice(0, 3).map((person) => (
                        <span
                          key={person.id}
                          title={person.name || person.email || ""}
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-white text-[7px] font-bold !text-[#ffffff] ${avatarColor(person.id)}`}
                        >
                          {initials(person.name, person.email)}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
                {dayEvents.length > 3 ? (
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-accent"
                    onClick={() => {
                      setSelectedDayKey(key);
                      setSelectedProjectId(dayEvents[0].projectId);
                    }}
                  >
                    +{dayEvents.length - 3} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {selectedProject ? (
        <div className="rounded-2xl border border-line bg-bg-elevated p-4 shadow-[var(--shadow)]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                {selectedProject.jobNumber}
              </p>
              <h3 className="display text-xl font-semibold">
                {selectedProject.jobName}
              </h3>
            </div>
            <div className="flex gap-2">
              <Link href={`/app/projects/${selectedProject.projectId}`}>
                <Button type="button" variant="ghost" className="!py-2">
                  Open project
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                className="!py-2"
                onClick={() => {
                  setSelectedProjectId(null);
                  setSelectedDayKey(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
          <DeadlineManager
            projectId={selectedProject.projectId}
            deadlines={selectedProject.allDeadlines}
            members={members}
          />
        </div>
      ) : null}

      {undated.length > 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white/70 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Deadlines without a date
          </p>
          <div className="flex flex-wrap gap-2">
            {undated.map((event) => (
              <button
                key={event.deadlineId}
                type="button"
                onClick={() => setSelectedProjectId(event.projectId)}
                className="rounded-full bg-bg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
              >
                {event.jobNumber} · {event.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
