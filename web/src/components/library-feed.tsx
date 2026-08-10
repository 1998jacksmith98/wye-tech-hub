"use client";

import { useMemo, useState } from "react";
import { EntryCard } from "@/components/entry-card";
import { LibraryEntryForm } from "@/components/library-entry-form";
import { Button, Input, Label, Select } from "@/components/ui";
import {
  CONTENT_TYPES,
  GENERIC_JOB_LABEL,
  TAG_SOURCES,
  TAG_STATUS,
  TAG_TOPICS,
} from "@/lib/constants";
import { parseTags } from "@/lib/utils";
import type { FeedEntry } from "@/components/entry-feed";

export type LibraryEntry = FeedEntry & {
  projectId?: string;
  jobNumber: string;
  jobName: string;
  isGeneric?: boolean;
};

type ProjectOption = {
  id: string;
  jobNumber: string;
  jobName: string;
};

function matchesQuery(entry: LibraryEntry, query: string) {
  if (!query) return true;
  const tags = parseTags(entry.tagsJson);
  const haystack = [
    entry.textContent,
    entry.contentType,
    entry.fileName || "",
    entry.linkUrl,
    entry.createdByName,
    entry.jobNumber,
    entry.jobName,
    entry.isGeneric ? "generic knowledge revit family" : "",
    ...Object.values(tags),
    ...Object.keys(tags),
  ]
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function LibraryFeed({
  entries,
  projects,
}: {
  entries: LibraryEntry[];
  projects: ProjectOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [jobNumber, setJobNumber] = useState("All");
  const [jobName, setJobName] = useState("All");
  const [topic, setTopic] = useState("All");
  const [source, setSource] = useState("All");
  const [status, setStatus] = useState("All");
  const [contentType, setContentType] = useState("All");

  const jobNumbers = useMemo(() => {
    const set = new Set(entries.map((e) => e.jobNumber));
    return Array.from(set).sort((a, b) => {
      if (a === GENERIC_JOB_LABEL) return -1;
      if (b === GENERIC_JOB_LABEL) return 1;
      return a.localeCompare(b);
    });
  }, [entries]);

  const jobNames = useMemo(() => {
    const set = new Set(entries.map((e) => e.jobName));
    return Array.from(set).sort((a, b) => {
      if (a === GENERIC_JOB_LABEL) return -1;
      if (b === GENERIC_JOB_LABEL) return 1;
      return a.localeCompare(b);
    });
  }, [entries]);

  const usedTopics = useMemo(() => {
    const set = new Set<string>([...TAG_TOPICS]);
    for (const entry of entries) {
      const tags = parseTags(entry.tagsJson);
      if (tags.topic) set.add(tags.topic);
    }
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (!matchesQuery(entry, query)) return false;
      if (jobNumber !== "All" && entry.jobNumber !== jobNumber) return false;
      if (jobName !== "All" && entry.jobName !== jobName) return false;

      const tags = parseTags(entry.tagsJson);
      if (
        topic !== "All" &&
        (tags.topic || "").toLowerCase() !== topic.toLowerCase()
      ) {
        return false;
      }
      if (
        source !== "All" &&
        (tags.source || "").toLowerCase() !== source.toLowerCase()
      ) {
        return false;
      }
      if (
        status !== "All" &&
        (tags.status || "").toLowerCase() !== status.toLowerCase()
      ) {
        return false;
      }
      if (
        contentType !== "All" &&
        entry.contentType.toLowerCase() !== contentType.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [entries, query, jobNumber, jobName, topic, source, status, contentType]);

  const hasFilters =
    query.trim() !== "" ||
    jobNumber !== "All" ||
    jobName !== "All" ||
    topic !== "All" ||
    source !== "All" ||
    status !== "All" ||
    contentType !== "All";

  function clearFilters() {
    setQuery("");
    setJobNumber("All");
    setJobName("All");
    setTopic("All");
    setSource("All");
    setStatus("All");
    setContentType("All");
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white/70 p-4">
        {showForm ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Add entry
              </p>
              <Button
                type="button"
                variant="ghost"
                className="!py-1.5"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
            <LibraryEntryForm projects={projects} />
          </>
        ) : (
          <Button type="button" onClick={() => setShowForm(true)}>
            + Add new entry
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/70 p-4">
        <div className="mb-3">
          <Label>Search the library</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "coordination", "custom family", job number, or a person…'
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <Label>Job number</Label>
            <Select
              value={jobNumber}
              onChange={(e) => setJobNumber(e.target.value)}
            >
              <option value="All">All jobs</option>
              {jobNumbers.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Job name</Label>
            <Select value={jobName} onChange={(e) => setJobName(e.target.value)}>
              <option value="All">All names</option>
              {jobNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Topic / category</Label>
            <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="All">All topics</option>
              {usedTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Source</Label>
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="All">All sources</option>
              {TAG_SOURCES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All statuses</option>
              {TAG_STATUS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Content type</Label>
            <Select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            >
              <option value="All">All types</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-muted">
            Showing {filtered.length} of {entries.length} entr
            {entries.length === 1 ? "y" : "ies"}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="!py-1.5"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center">
            <p className="display text-lg font-semibold">Library is empty</p>
            <p className="mt-1 text-sm text-ink-soft">
              Add the first tip above — project-specific or generic knowledge.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center">
            <p className="display text-lg font-semibold text-ink">No matches</p>
            <p className="mt-1 text-sm text-ink-soft">
              Try a broader keyword, or clear the filters.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-4"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          filtered.map((entry) => (
            <EntryCard key={entry.id} entry={entry} showProject />
          ))
        )}
      </div>
    </div>
  );
}
