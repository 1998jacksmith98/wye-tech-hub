"use client";

import { useState, useTransition } from "react";
import { addLibraryEntry } from "@/lib/actions/entries";
import {
  CONTENT_TYPES,
  TAG_SOURCES,
  TAG_STATUS,
  TAG_TOPICS,
} from "@/lib/constants";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PasteableFileField } from "@/components/pasteable-file-field";

type ProjectOption = {
  id: string;
  jobNumber: string;
  jobName: string;
};

export function LibraryEntryForm({ projects }: { projects: ProjectOption[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState("");

  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("scope", projectId ? "project" : "generic");
        setError("");
        start(async () => {
          try {
            await addLibraryEntry(fd);
            form.reset();
            setProjectId("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add entry");
          }
        });
      }}
    >
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
              {p.jobNumber} – {p.jobName}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-ink-muted">
          Optional. Leave unlinked for general Revit tips, families, standards
          — anything that isn&apos;t tied to one job.
        </p>
      </div>

      <div>
        <Label>Content type</Label>
        <Select name="contentType" defaultValue="Note">
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue="—">
          <option value="—">—</option>
          {TAG_STATUS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label>Notes / solution</Label>
        <Textarea
          name="textContent"
          rows={4}
          placeholder="What was the problem, and how did you fix it?"
        />
      </div>
      <div>
        <Label>Source</Label>
        <Select name="source" defaultValue="—">
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
        <Select name="topic" defaultValue="—">
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
        <Input name="person" placeholder="e.g. Tom Harris" />
      </div>
      <div>
        <Label>Link (Outlook / Teams URL)</Label>
        <Input name="linkUrl" placeholder="https://... or outlook:..." />
      </div>
      <div className="md:col-span-2">
        <Label>Attach file (.msg, image, PDF…)</Label>
        <PasteableFileField
          name="file"
          hint="Screenshots can be pasted straight from the clipboard — no need to save to Desktop first."
        />
      </div>
      {error ? <p className="md:col-span-2 text-sm text-danger">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Add to library"}
        </Button>
      </div>
    </form>
  );
}
