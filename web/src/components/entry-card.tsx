"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateEntry, deleteEntry } from "@/lib/actions/entries";
import {
  CONTENT_TYPES,
  TAG_SOURCES,
  TAG_STATUS,
  TAG_TOPICS,
} from "@/lib/constants";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PasteableFileField } from "@/components/pasteable-file-field";
import { isImageFile, parseTags } from "@/lib/utils";

type EntryCardProps = {
  entry: {
    id: string;
    contentType: string;
    textContent: string;
    linkUrl: string;
    fileName: string | null;
    sharePointWebUrl: string | null;
    localFilePath: string | null;
    tagsJson: string;
    createdAt: string | Date;
    createdByName: string;
    projectId?: string;
    jobNumber?: string;
    jobName?: string;
  };
  showProject?: boolean;
};

function matchContentType(value: string) {
  const lower = value.toLowerCase();
  return (
    CONTENT_TYPES.find((t) => t.toLowerCase() === lower) ||
    CONTENT_TYPES[0]
  );
}

export function EntryCard({ entry, showProject = false }: EntryCardProps) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const tags = parseTags(entry.tagsJson);
  const fileHref =
    entry.sharePointWebUrl ||
    (entry.localFilePath ? `/api/files/${entry.id}` : null);
  const createdAt =
    typeof entry.createdAt === "string"
      ? entry.createdAt.slice(0, 16).replace("T", " ")
      : entry.createdAt.toISOString().slice(0, 16).replace("T", " ");

  if (editing) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-ink">Edit entry</p>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            setError("");
            start(async () => {
              try {
                await updateEntry(entry.id, fd);
                setEditing(false);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not update entry",
                );
              }
            });
          }}
        >
          <div>
            <Label>Content type</Label>
            <Select
              name="contentType"
              defaultValue={matchContentType(entry.contentType)}
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue={tags.status || "—"}>
              <option value="—">—</option>
              {TAG_STATUS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              name="textContent"
              rows={4}
              defaultValue={entry.textContent}
            />
          </div>
          <div>
            <Label>Source</Label>
            <Select name="source" defaultValue={tags.source || "—"}>
              <option value="—">—</option>
              {TAG_SOURCES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Topic</Label>
            <Select name="topic" defaultValue={tags.topic || "—"}>
              <option value="—">—</option>
              {TAG_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Engineer / person</Label>
            <Input name="person" defaultValue={tags.person || ""} />
          </div>
          <div>
            <Label>Link (Outlook / Teams URL)</Label>
            <Input name="linkUrl" defaultValue={entry.linkUrl || ""} />
          </div>
          <div className="md:col-span-2">
            <Label>Replace file (optional)</Label>
            <PasteableFileField
              name="file"
              hint="Paste a new screenshot, or browse for a file."
            />
            {entry.fileName ? (
              <p className="mt-1 text-xs text-ink-muted">
                Current file: {entry.fileName}
              </p>
            ) : null}
          </div>
          {error ? (
            <p className="md:col-span-2 text-sm text-danger">{error}</p>
          ) : null}
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      {showProject ? (
        entry.projectId ? (
          <Link
            href={`/app/projects/${entry.projectId}`}
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-deep hover:bg-accent hover:!text-[#ffffff]"
          >
            <span>{entry.jobNumber}</span>
            <span className="opacity-70">·</span>
            <span>{entry.jobName}</span>
          </Link>
        ) : (
          <span className="mb-3 inline-flex items-center rounded-full bg-bg-deep px-3 py-1 text-xs font-semibold !text-[#ffffff]">
            Generic knowledge
          </span>
        )
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{entry.contentType}</Badge>
          <span className="text-xs text-ink-muted">
            {entry.createdByName} · {createdAt}
          </span>
        </div>
        <div className="flex items-center gap-3">
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
              if (!confirm("Delete this entry?")) return;
              start(async () => {
                await deleteEntry(entry.id);
              });
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {entry.textContent ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {entry.textContent}
        </p>
      ) : null}
      {fileHref ? (
        <a
          href={fileHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-accent hover:text-accent-deep"
        >
          {isImageFile(entry.fileName)
            ? `Open image · ${entry.fileName}`
            : `Open file · ${entry.fileName}`}
        </a>
      ) : null}
      {entry.linkUrl ? (
        <a
          href={entry.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-sm font-semibold text-accent hover:text-accent-deep"
        >
          Open link
        </a>
      ) : null}
      {Object.keys(tags).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(tags).map(([k, v]) => (
            <span
              key={k}
              className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-ink-soft"
            >
              {k}: {v}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
