"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addFamily,
  deleteFamily,
  deleteFamilyImage,
  updateFamily,
} from "@/lib/actions/families";
import {
  FAMILY_CATEGORIES,
  REVIT_VERSIONS,
} from "@/lib/constants";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PasteableFileField } from "@/components/pasteable-file-field";

export type FamilyImageData = {
  id: string;
  fileName: string;
  sharePointWebUrl: string | null;
  localFilePath: string | null;
};

export type FamilyProjectOption = {
  id: string;
  jobNumber: string;
  jobName: string;
};

export type FamilyData = {
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
  revitVersion: string;
  createdByName: string;
  createdAt: string | Date;
  images: FamilyImageData[];
};

function imageSrc(image: FamilyImageData) {
  if (image.sharePointWebUrl) return image.sharePointWebUrl;
  if (image.localFilePath) return `/api/family-images/${image.id}`;
  return null;
}

function FamilyForm({
  initial,
  projects,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: FamilyData;
  projects: FamilyProjectOption[];
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
        <Label>Family name</Label>
        <Input
          name="name"
          required
          placeholder="e.g. WYE_Door_Flush_Timber"
          defaultValue={initial?.name || ""}
        />
      </div>
      <div>
        <Label>Category</Label>
        <Select name="category" defaultValue={initial?.category || "Other"}>
          {FAMILY_CATEGORIES.map((c) => (
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
        <p className="mt-1 text-xs text-ink-muted">
          Optional. Linked families appear on that job&apos;s information feed
          under Project specific families.
        </p>
      </div>
      <div className="md:col-span-2">
        <Label>.rfa network path</Label>
        <Input
          name="filePath"
          required
          placeholder={`\\\\server\\jobs\\WYE-2026-001\\Families\\Doors\\MyFamily.rfa`}
          defaultValue={initial?.filePath || ""}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Don&apos;t upload the .rfa — paste the path from the job Families folder
          so others can copy it in File Explorer.
        </p>
      </div>
      <div className="md:col-span-2">
        <Label>Description</Label>
        <Textarea
          name="description"
          rows={3}
          placeholder="What it is, when to use it, any modelling notes…"
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
          placeholder="e.g. louvre, acoustic, fire rated"
          defaultValue={initial?.keywords || ""}
        />
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
        <Label>Preview images</Label>
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

function FamilyCard({
  family,
  projects,
  onChanged,
}: {
  family: FamilyData;
  projects: FamilyProjectOption[];
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
        <p className="mb-3 text-sm font-semibold">Edit family</p>
        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        <FamilyForm
          initial={family}
          projects={projects}
          pending={pending}
          submitLabel={pending ? "Saving..." : "Save changes"}
          onCancel={() => setEditing(false)}
          onSubmit={(fd) => {
            setError("");
            start(async () => {
              try {
                await updateFamily(family.id, fd);
                setEditing(false);
                onChanged?.();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save");
              }
            });
          }}
        />
        {family.images.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Existing images
            </p>
            <div className="flex flex-wrap gap-2">
              {family.images.map((img) => {
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
                          await deleteFamilyImage(img.id);
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
            {family.category}
            {family.revitVersion ? ` · Revit ${family.revitVersion}` : ""}
          </p>
          <h3 className="display mt-1 text-xl font-semibold">{family.name}</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Added by {family.createdByName}
            {family.jobNumber
              ? ` · from ${family.jobNumber}${family.jobName ? ` – ${family.jobName}` : ""}`
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
              if (!confirm(`Remove "${family.name}" from the library?`)) return;
              start(async () => {
                await deleteFamily(family.id);
                onChanged?.();
              });
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {family.description ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {family.description}
        </p>
      ) : null}

      {family.images.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {family.images.map((img) => {
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
        {family.materials
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
        {family.keywords
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
        <p className="mt-1 break-all font-mono text-xs text-ink">{family.filePath}</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 !py-1.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(family.filePath);
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

export function FamilyLibrary({
  families,
  projects,
}: {
  families: FamilyData[];
  projects: FamilyProjectOption[];
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
      Array.from(new Set(families.map((f) => f.jobNumber).filter(Boolean))).sort(),
    [families],
  );
  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const f of families) {
      for (const m of f.materials.split(",").map((x) => x.trim()).filter(Boolean)) {
        set.add(m);
      }
    }
    return Array.from(set).sort();
  }, [families]);

  const filtered = useMemo(() => {
    return families.filter((f) => {
      if (category !== "All" && f.category !== category) return false;
      if (jobNumber !== "All" && f.jobNumber !== jobNumber) return false;
      if (
        material !== "All" &&
        !f.materials
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .includes(material.toLowerCase())
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const haystack = [
        f.name,
        f.description,
        f.category,
        f.materials,
        f.keywords,
        f.jobNumber,
        f.jobName,
        f.filePath,
        f.revitVersion,
        f.createdByName,
      ]
        .join(" ")
        .toLowerCase();
      return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => haystack.includes(term));
    });
  }, [families, query, category, jobNumber, material]);

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
                Add family
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
            <FamilyForm
              pending={pending}
              projects={projects}
              submitLabel={pending ? "Saving..." : "Add to library"}
              onCancel={() => setShowForm(false)}
              onSubmit={(fd) => {
                setError("");
                start(async () => {
                  try {
                    await addFamily(fd);
                    setShowForm(false);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not add family",
                    );
                  }
                });
              }}
            />
          </>
        ) : (
          <Button type="button" onClick={() => setShowForm(true)}>
            + Add family
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white/70 p-4">
        <div className="mb-3">
          <Label>Search families</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "door", "concrete", job number, or a keyword…'
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All categories</option>
              {FAMILY_CATEGORIES.map((c) => (
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
            Showing {filtered.length} of {families.length} famil
            {families.length === 1 ? "y" : "ies"}
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
        {families.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center">
            <p className="display text-lg font-semibold">No families yet</p>
            <p className="mt-1 text-sm text-ink-soft">
              Add the first one with its network path and a few preview photos.
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
          filtered.map((family) => (
            <FamilyCard key={family.id} family={family} projects={projects} />
          ))
        )}
      </div>
    </div>
  );
}
