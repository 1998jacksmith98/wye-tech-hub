"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addTypicalDetail,
  deleteTypicalDetail,
  deleteTypicalDetailImage,
  updateTypicalDetail,
} from "@/lib/actions/details";
import { ARCHITECT_SOFTWARES, DETAIL_CATEGORIES } from "@/lib/constants";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PasteableFileField } from "@/components/pasteable-file-field";

export type DetailImageData = {
  id: string;
  fileName: string;
  sharePointWebUrl: string | null;
  localFilePath: string | null;
};

export type DetailProjectOption = {
  id: string;
  jobNumber: string;
  jobName: string;
};

export type DetailData = {
  id: string;
  name: string;
  description: string;
  category: string;
  materials: string;
  keywords: string;
  filePath: string;
  jobNumber: string;
  jobName: string;
  projectId: string | null;
  drawnIn: string;
  createdByName: string;
  createdAt: string | Date;
  images: DetailImageData[];
};

function imageSrc(image: DetailImageData) {
  if (image.sharePointWebUrl) return image.sharePointWebUrl;
  if (image.localFilePath) return `/api/detail-images/${image.id}`;
  return null;
}

function DetailForm({
  initial,
  projects,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: DetailData;
  projects: DetailProjectOption[];
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
        <Label>Detail name</Label>
        <Input
          name="name"
          required
          placeholder="e.g. Typical pad foundation"
          defaultValue={initial?.name || ""}
        />
      </div>
      <div>
        <Label>Category</Label>
        <Select name="category" defaultValue={initial?.category || "Other"}>
          {DETAIL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
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
      </div>
      <div className="md:col-span-2">
        <Label>File network path</Label>
        <Input
          name="filePath"
          required
          placeholder={`\\\\server\\jobs\\J5768\\Details\\Typical-pad.dwg`}
          defaultValue={initial?.filePath || ""}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Don&apos;t upload the CAD/PDF — paste the path from the job folder so
          others can copy it in File Explorer.
        </p>
      </div>
      <div className="md:col-span-2">
        <Label>Description</Label>
        <Textarea
          name="description"
          rows={3}
          placeholder="What it is, when to use it, any drawing notes…"
          defaultValue={initial?.description || ""}
        />
      </div>
      <div>
        <Label>Materials (comma separated)</Label>
        <Input
          name="materials"
          placeholder="e.g. Concrete, Steel, Timber"
          defaultValue={initial?.materials || ""}
        />
      </div>
      <div>
        <Label>Keywords (comma separated)</Label>
        <Input
          name="keywords"
          placeholder="e.g. pad, holding down, DPC"
          defaultValue={initial?.keywords || ""}
        />
      </div>
      <div>
        <Label>Drawn in</Label>
        <Select name="drawnIn" defaultValue={initial?.drawnIn || "AutoCAD"}>
          {ARCHITECT_SOFTWARES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Preview images / screenshots</Label>
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

function DetailCard({
  detail,
  projects,
  onChanged,
}: {
  detail: DetailData;
  projects: DetailProjectOption[];
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (editing) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-white p-4">
        <p className="mb-3 text-sm font-semibold">Edit typical detail</p>
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <DetailForm
          initial={detail}
          projects={projects}
          pending={pending}
          submitLabel={pending ? "Saving..." : "Save changes"}
          onCancel={() => setEditing(false)}
          onSubmit={(fd) => {
            setError("");
            start(async () => {
              try {
                await updateTypicalDetail(detail.id, fd);
                setEditing(false);
                onChanged?.();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save");
              }
            });
          }}
        />
        {detail.images.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Existing images
            </p>
            <div className="flex flex-wrap gap-2">
              {detail.images.map((img) => {
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
                          await deleteTypicalDetailImage(img.id);
                          onChanged?.();
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            {detail.category}
            {detail.drawnIn ? ` · ${detail.drawnIn}` : ""}
          </p>
          <h3 className="display mt-1 text-xl font-semibold">{detail.name}</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Added by {detail.createdByName}
            {detail.jobNumber
              ? ` · from ${detail.jobNumber}${detail.jobName ? ` – ${detail.jobName}` : ""}`
              : ""}
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
              if (!confirm(`Remove "${detail.name}" from the library?`)) return;
              start(async () => {
                await deleteTypicalDetail(detail.id);
                onChanged?.();
              });
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {detail.description ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {detail.description}
        </p>
      ) : null}

      {detail.images.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {detail.images.map((img) => {
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

      <div className="mt-3 flex flex-wrap gap-2">
        {detail.materials
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)
          .map((m) => (
            <span
              key={m}
              className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-ink-soft"
            >
              {m}
            </span>
          ))}
        {detail.keywords
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

      <div className="mt-4 rounded-xl border border-line bg-bg/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
          File path
        </p>
        <p className="mt-1 break-all font-mono text-xs text-ink">{detail.filePath}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 !py-1.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(detail.filePath);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setError("Could not copy — select the path manually.");
            }
          }}
        >
          {copied ? "Copied!" : "Copy path"}
        </Button>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>

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

export function DetailLibrary({
  details,
  projects,
}: {
  details: DetailData[];
  projects: DetailProjectOption[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [jobNumber, setJobNumber] = useState("All");
  const [material, setMaterial] = useState("All");

  const jobNumbers = useMemo(
    () =>
      Array.from(new Set(details.map((d) => d.jobNumber).filter(Boolean))).sort(),
    [details],
  );
  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const d of details) {
      for (const m of d.materials.split(",").map((x) => x.trim()).filter(Boolean)) {
        set.add(m);
      }
    }
    return Array.from(set).sort();
  }, [details]);

  const filtered = useMemo(() => {
    return details.filter((d) => {
      if (category !== "All" && d.category !== category) return false;
      if (jobNumber !== "All" && d.jobNumber !== jobNumber) return false;
      if (
        material !== "All" &&
        !d.materials
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .includes(material.toLowerCase())
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const haystack = [
        d.name,
        d.description,
        d.category,
        d.materials,
        d.keywords,
        d.jobNumber,
        d.jobName,
        d.filePath,
        d.drawnIn,
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
  }, [details, query, category, jobNumber, material]);

  const hasFilters =
    query.trim() !== "" ||
    category !== "All" ||
    jobNumber !== "All" ||
    material !== "All";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-white/70 p-4">
        {showForm ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Add typical detail
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
            <DetailForm
              projects={projects}
              pending={pending}
              submitLabel={pending ? "Saving..." : "Add to library"}
              onCancel={() => setShowForm(false)}
              onSubmit={(fd) => {
                setError("");
                start(async () => {
                  try {
                    await addTypicalDetail(fd);
                    setShowForm(false);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not add detail",
                    );
                  }
                });
              }}
            />
          </>
        ) : (
          <Button type="button" onClick={() => setShowForm(true)}>
            + Add typical detail
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/70 p-4">
        <div className="mb-3">
          <Label>Search typical details</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "pad", "steel", job number, or a keyword…'
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All categories</option>
              {DETAIL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
          <div>
            <Label>Material</Label>
            <Select value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="All">All materials</option>
              {materials.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-muted">
            Showing {filtered.length} of {details.length} detail
            {details.length === 1 ? "" : "s"}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="!py-1.5"
              onClick={() => {
                setQuery("");
                setCategory("All");
                setJobNumber("All");
                setMaterial("All");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {details.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center">
            <p className="display text-lg font-semibold">No typical details yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              Add the first one with its network path, a project link, and a few
              preview screenshots.
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
          filtered.map((detail) => (
            <DetailCard key={detail.id} detail={detail} projects={projects} />
          ))
        )}
      </div>
    </div>
  );
}
