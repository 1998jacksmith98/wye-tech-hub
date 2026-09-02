"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addTechnicalIssue,
  deleteTechnicalIssue,
  deleteTechnicalIssueImage,
  updateTechnicalIssue,
} from "@/lib/actions/issues";
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUSES,
  REVIT_VERSIONS,
} from "@/lib/constants";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PasteableFileField } from "@/components/pasteable-file-field";

export type IssueImageData = {
  id: string;
  fileName: string;
  sharePointWebUrl: string | null;
  localFilePath: string | null;
};

export type IssueProjectOption = {
  id: string;
  jobNumber: string;
  jobName: string;
};

export type IssueData = {
  id: string;
  name: string;
  description: string;
  workaround: string;
  status: string;
  category: string;
  keywords: string;
  jobNumber: string;
  jobName: string;
  projectId: string | null;
  revitVersion: string;
  createdByName: string;
  createdAt: string | Date;
  images: IssueImageData[];
};

function imageSrc(image: IssueImageData) {
  if (image.sharePointWebUrl) return image.sharePointWebUrl;
  if (image.localFilePath) return `/api/issue-images/${image.id}`;
  return null;
}

function IssueForm({
  initial,
  projects,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: IssueData;
  projects: IssueProjectOption[];
  pending: boolean;
  submitLabel: string;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const [projectId, setProjectId] = useState(initial?.projectId || "");

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <div>
        <Label>Title</Label>
        <Input
          name="name"
          required
          placeholder="e.g. Room tag disappears after copy/monitor"
          defaultValue={initial?.name || ""}
        />
      </div>
      <div>
        <Label>Category</Label>
        <Select name="category" defaultValue={initial?.category || "Other"}>
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={initial?.status || "Needs attention"}>
          {ISSUE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Revit version</Label>
        <Select
          name="revitVersion"
          defaultValue={initial?.revitVersion || REVIT_VERSIONS[4]}
        >
          {REVIT_VERSIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Link to project</Label>
        <Select
          name="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">— Not linked —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.jobNumber} — {p.jobName}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-ink-muted">
          Optional. Linked issues also show on that job&apos;s information
          feed. Every issue appears on the master feed either way.
        </p>
      </div>
      <div className="md:col-span-2">
        <Label>The issue</Label>
        <Textarea
          name="description"
          required
          rows={4}
          placeholder="What happens, when it happens, error text if any…"
          defaultValue={initial?.description || ""}
        />
      </div>
      <div className="md:col-span-2">
        <Label>Workaround or fix</Label>
        <Textarea
          name="workaround"
          rows={3}
          placeholder="What you did that worked — or leave blank if it still needs attention."
          defaultValue={initial?.workaround || ""}
        />
      </div>
      <div className="md:col-span-2">
        <Label>Keywords (comma separated)</Label>
        <Input
          name="keywords"
          placeholder="e.g. worksets, warnings, copy/monitor"
          defaultValue={initial?.keywords || ""}
        />
      </div>
      <div className="md:col-span-2">
        <Label>Screenshots</Label>
        <PasteableFileField
          name="images"
          multiple
          accept="image/*"
          hint="Paste screenshots (Ctrl+V) as many times as you need, or browse and multi-select."
        />
      </div>
      <div className="md:col-span-2 flex gap-2">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function IssueCard({
  issue,
  projects,
}: {
  issue: IssueData;
  projects: IssueProjectOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const resolved = issue.status === "Resolved";

  if (editing) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-white p-4">
        <p className="mb-3 text-sm font-semibold">Edit technical issue</p>
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <IssueForm
          initial={issue}
          projects={projects}
          pending={pending}
          submitLabel={pending ? "Saving..." : "Save changes"}
          onCancel={() => setEditing(false)}
          onSubmit={(fd) => {
            setError("");
            start(async () => {
              try {
                await updateTechnicalIssue(issue.id, fd);
                setEditing(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save");
              }
            });
          }}
        />
        {issue.images.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Existing images
            </p>
            <div className="flex flex-wrap gap-2">
              {issue.images.map((img) => {
                const src = imageSrc(img);
                return (
                  <div key={img.id} className="relative">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={img.fileName}
                        className="h-20 w-28 rounded-lg object-cover"
                      />
                    ) : null}
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold !text-[#ffffff]"
                      onClick={() => {
                        start(async () => {
                          await deleteTechnicalIssueImage(img.id);
                        });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {issue.category}
              {issue.revitVersion ? ` · Revit ${issue.revitVersion}` : ""}
            </p>
            <Badge tone={resolved ? "success" : "warning"}>{issue.status}</Badge>
          </div>
          <h3 className="display mt-1 text-xl font-semibold">{issue.name}</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Added by {issue.createdByName}
            {issue.jobNumber
              ? ` · linked to ${issue.jobNumber}${issue.jobName ? ` – ${issue.jobName}` : ""}`
              : " · not linked to a job"}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-ink-muted hover:text-accent"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-ink-muted hover:text-danger"
            onClick={() => {
              if (!confirm(`Remove "${issue.name}" from Technical issues?`)) return;
              start(async () => {
                await deleteTechnicalIssue(issue.id);
              });
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {issue.description}
      </p>

      {issue.workaround ? (
        <div className="mt-3 rounded-xl border border-line bg-bg/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Workaround / fix
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {issue.workaround}
          </p>
        </div>
      ) : null}

      {issue.images.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {issue.images.map((img) => {
            const src = imageSrc(img);
            if (!src) return null;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(src)}
                className="shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={img.fileName}
                  className="h-28 w-40 rounded-xl object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {issue.keywords ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {issue.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
            .map((k) => (
              <span
                key={k}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-deep"
              >
                {k}
              </span>
            ))}
        </div>
      ) : null}

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Preview"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </button>
      ) : null}
    </article>
  );
}

export function IssueLibrary({
  issues,
  projects,
}: {
  issues: IssueData[];
  projects: IssueProjectOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [jobNumber, setJobNumber] = useState("All");

  const jobNumbers = useMemo(
    () =>
      Array.from(new Set(issues.map((d) => d.jobNumber).filter(Boolean))).sort(),
    [issues],
  );

  const filtered = useMemo(() => {
    return issues.filter((d) => {
      if (category !== "All" && d.category !== category) return false;
      if (status !== "All" && d.status !== status) return false;
      if (jobNumber !== "All" && d.jobNumber !== jobNumber) return false;
      if (!query.trim()) return true;
      const haystack = [
        d.name,
        d.description,
        d.workaround,
        d.category,
        d.status,
        d.keywords,
        d.jobNumber,
        d.jobName,
        d.revitVersion,
        d.createdByName,
      ]
        .join(" ")
        .toLowerCase();
      return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => haystack.includes(term));
    });
  }, [issues, query, category, status, jobNumber]);

  const hasFilters =
    query.trim() !== "" ||
    category !== "All" ||
    status !== "All" ||
    jobNumber !== "All";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white/70 p-4">
        {showForm ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Add technical issue
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
            {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
            <IssueForm
              projects={projects}
              pending={pending}
              submitLabel={pending ? "Saving..." : "Add to library"}
              onCancel={() => setShowForm(false)}
              onSubmit={(fd) => {
                setError("");
                start(async () => {
                  try {
                    await addTechnicalIssue(fd);
                    setShowForm(false);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not add issue",
                    );
                  }
                });
              }}
            />
          </>
        ) : (
          <Button type="button" onClick={() => setShowForm(true)}>
            + Add technical issue
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/70 p-4">
        <div className="mb-3">
          <Label>Search technical issues</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "warning", job number, or a keyword…'
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All categories</option>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All statuses</option>
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
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
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-muted">
            Showing {filtered.length} of {issues.length} issue
            {issues.length === 1 ? "" : "s"}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="!py-1.5"
              onClick={() => {
                setQuery("");
                setCategory("All");
                setStatus("All");
                setJobNumber("All");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {issues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center">
            <p className="display text-lg font-semibold">No technical issues yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              Add the first one with a description, screenshots, and whether it
              is resolved or still needs attention.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center">
            <p className="display text-lg font-semibold">No matches</p>
            <p className="mt-1 text-sm text-ink-soft">
              Try another keyword or clear the filters.
            </p>
          </div>
        ) : (
          filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} projects={projects} />
          ))
        )}
      </div>
    </div>
  );
}
