"use client";

import { useMemo, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { addGuide, deleteGuide, updateGuide } from "@/lib/actions/guides";
import { GUIDE_CATEGORIES } from "@/lib/constants";
import { guideKind, guideMimeType, isGuideFileName } from "@/lib/guides";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PasteableFileField } from "@/components/pasteable-file-field";

export type GuideData = {
  id: string;
  title: string;
  summary: string;
  category: string;
  keywords: string;
  fileName: string;
  iconUrl: string | null;
  createdByName: string;
  createdAt: string | Date;
};

async function attachGuideFile(fd: FormData, file: File | null) {
  if (!file || file.size === 0) return;
  if (!isGuideFileName(file.name)) {
    throw new Error("Upload a Word document (.doc, .docx) or PowerPoint (.ppt, .pptx).");
  }
  try {
    const blob = await upload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/guides/blob",
      contentType: guideMimeType(file.name, file.type),
      multipart: file.size > 4 * 1024 * 1024,
    });
    fd.set("blobUrl", blob.url);
    fd.set("blobPath", blob.pathname);
    fd.set("blobFileName", file.name);
    return;
  } catch {
    fd.set("file", file);
  }
}

function GuideForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: GuideData;
  pending: boolean;
  submitLabel: string;
  onSubmit: (fd: FormData, file: File | null) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const picked = form.elements.namedItem("file");
        const file =
          picked instanceof HTMLInputElement && picked.files?.[0]
            ? picked.files[0]
            : null;
        fd.delete("file");
        onSubmit(fd, file);
      }}
    >
      <div>
        <Label>Title</Label>
        <Input
          name="title"
          required
          placeholder="e.g. Setting up a new structural model"
          defaultValue={initial?.title || ""}
        />
      </div>
      <div>
        <Label>Category</Label>
        <Select
          name="category"
          defaultValue={
            initial &&
            (GUIDE_CATEGORIES as readonly string[]).includes(initial.category)
              ? initial.category
              : "Other"
          }
        >
          {GUIDE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>What this guide covers</Label>
        <Textarea
          name="summary"
          rows={4}
          placeholder="A short description so people can tell if this is the guide they need before opening it."
          defaultValue={initial?.summary || ""}
        />
      </div>
      <div className="md:col-span-2">
        <Label>Keywords (comma separated)</Label>
        <Input
          name="keywords"
          placeholder="e.g. worksets, view templates, sheets"
          defaultValue={initial?.keywords || ""}
        />
      </div>
      <div className="md:col-span-2">
        <Label>
          {initial ? "Replace document (optional)" : "Word or PowerPoint file"}
        </Label>
        <Input
          name="file"
          type="file"
          accept=".doc,.docx,.ppt,.pptx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          required={!initial}
        />
        {initial?.fileName ? (
          <p className="mt-1 text-xs text-ink-muted">Current file: {initial.fileName}</p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            .doc, .docx, .ppt or .pptx. These guides are not linked to a job.
          </p>
        )}
      </div>
      <div className="md:col-span-2">
        <Label>Picture (optional)</Label>
        {initial?.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initial.iconUrl}
            alt=""
            className="mb-2 h-20 w-20 rounded-xl bg-bg object-contain"
          />
        ) : null}
        <PasteableFileField
          name="icon"
          accept="image/*"
          hint="A small picture shown on the guide tile. Paste a screenshot or browse for an image."
        />
        {initial?.iconUrl ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
            <input name="removeIcon" type="checkbox" />
            Remove the current picture
          </label>
        ) : null}
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

function GuideCard({ guide }: { guide: GuideData }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const kind = guideKind(guide.fileName);

  if (editing) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-white p-6 md:col-span-2">
        <p className="mb-3 text-sm font-semibold">Edit guide</p>
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <GuideForm
          initial={guide}
          pending={pending}
          submitLabel={pending ? "Saving..." : "Save changes"}
          onCancel={() => setEditing(false)}
          onSubmit={(fd, file) => {
            setError("");
            start(async () => {
              try {
                await attachGuideFile(fd, file);
                await updateGuide(guide.id, fd);
                setEditing(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save");
              }
            });
          }}
        />
      </div>
    );
  }

  return (
    <article className="flex min-h-56 flex-col rounded-2xl border border-line bg-white p-6">
      <div className="flex items-start gap-4">
        {guide.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guide.iconUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl bg-bg object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {kind} · {guide.category}
        </p>
        <div className="flex shrink-0 gap-3">
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
              if (!confirm(`Remove "${guide.title}" from Guides?`)) return;
              start(async () => {
                await deleteGuide(guide.id);
              });
            }}
          >
            Delete
          </button>
        </div>
          </div>
          <h3 className="display mt-2 text-2xl font-semibold leading-tight">{guide.title}</h3>
        </div>
      </div>
      {guide.summary ? (
        <p className="mt-3 flex-1 text-base leading-relaxed text-ink">{guide.summary}</p>
      ) : (
        <p className="mt-3 flex-1 text-sm text-ink-muted">No description yet.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {guide.keywords
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
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-ink-muted">
          {guide.fileName}
          <span> · {guide.createdByName}</span>
        </p>
        <a
          href={`/api/guides/${guide.id}/file`}
          className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold !text-[#ffffff] hover:bg-accent-deep"
        >
          Open document
        </a>
      </div>
    </article>
  );
}

export function GuideLibrary({ guides }: { guides: GuideData[] }) {
  const [showForm, setShowForm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [kind, setKind] = useState("All");

  const filtered = useMemo(() => {
    return guides.filter((guide) => {
      if (category !== "All" && guide.category !== category) return false;
      if (kind !== "All" && guideKind(guide.fileName) !== kind) return false;
      if (!query.trim()) return true;
      const haystack = [
        guide.title,
        guide.summary,
        guide.category,
        guide.keywords,
        guide.fileName,
        guide.createdByName,
        guideKind(guide.fileName),
      ]
        .join(" ")
        .toLowerCase();
      return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => haystack.includes(term));
    });
  }, [guides, query, category, kind]);

  const hasFilters = query.trim() !== "" || category !== "All" || kind !== "All";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white/70 p-4">
        {showForm ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Add guide
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
            <GuideForm
              pending={pending}
              submitLabel={pending ? "Saving..." : "Add guide"}
              onCancel={() => setShowForm(false)}
              onSubmit={(fd, file) => {
                setError("");
                start(async () => {
                  try {
                    await attachGuideFile(fd, file);
                    await addGuide(fd);
                    setShowForm(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not add guide");
                  }
                });
              }}
            />
          </>
        ) : (
          <Button type="button" onClick={() => setShowForm(true)}>
            + Add guide
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/70 p-4">
        <div className="mb-3">
          <Label>Search guides</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "worksets", "sheets", a name, or a keyword…'
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All categories</option>
              {GUIDE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Document type</Label>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="All">Word and PowerPoint</option>
              <option value="Word">Word</option>
              <option value="PowerPoint">PowerPoint</option>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-muted">
            Showing {filtered.length} of {guides.length} guide
            {guides.length === 1 ? "" : "s"}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="!py-1.5"
              onClick={() => {
                setQuery("");
                setCategory("All");
                setKind("All");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {guides.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center">
          <p className="display text-lg font-semibold">No guides yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Upload a Word or PowerPoint guide so the team can find it here and in Revit.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center">
          <p className="display text-lg font-semibold">No matches</p>
          <p className="mt-1 text-sm text-ink-soft">Try another keyword or clear the filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
