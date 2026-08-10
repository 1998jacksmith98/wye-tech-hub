"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type PasteableFileFieldProps = {
  name: string;
  multiple?: boolean;
  /** e.g. "image/*" or leave open for .msg / PDF too */
  accept?: string;
  className?: string;
  hint?: string;
};

function screenshotFileName(file: File) {
  const subtype = file.type.split("/")[1] || "png";
  const ext = subtype === "jpeg" ? "jpg" : subtype;
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  if (file.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
    return file.name;
  }
  return `screenshot-${stamp}.${ext}`;
}

function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items)) {
    if (!item.type.startsWith("image/")) continue;
    const raw = item.getAsFile();
    if (!raw || raw.size === 0) continue;
    out.push(new File([raw], screenshotFileName(raw), { type: raw.type || "image/png" }));
  }
  return out;
}

export function PasteableFileField({
  name,
  multiple = false,
  accept,
  className,
  hint,
}: PasteableFileFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    for (const file of files) dt.items.add(file);
    input.files = dt.files;
  }, [files]);

  useEffect(() => {
    const urls = files
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    setPreviews(urls);
    return () => {
      for (const p of urls) URL.revokeObjectURL(p.url);
    };
  }, [files]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const onPaste = (e: ClipboardEvent) => {
      const pasted = filesFromClipboard(e.clipboardData);
      if (pasted.length === 0) return;
      e.preventDefault();
      setFiles((prev) => (multiple ? [...prev, ...pasted] : [pasted[0]]));
      setStatus(
        pasted.length === 1
          ? "Screenshot pasted"
          : `${pasted.length} screenshots pasted`,
      );
      window.setTimeout(() => setStatus(""), 1800);
    };

    const onReset = () => {
      setFiles([]);
      setStatus("");
    };

    form.addEventListener("paste", onPaste);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("paste", onPaste);
      form.removeEventListener("reset", onReset);
    };
  }, [multiple]);

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      <div
        className="rounded-xl border border-dashed border-line bg-bg/50 px-3 py-3"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files).filter((f) => {
            if (!accept || accept === "*/*") return true;
            if (accept === "image/*") return f.type.startsWith("image/");
            return true;
          });
          if (dropped.length === 0) return;
          setFiles((prev) =>
            multiple ? [...prev, ...dropped] : [dropped[0]],
          );
        }}
      >
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">Paste a screenshot</span>
          {" "}(Ctrl+V / Cmd+V) while this form is focused, or browse below.
        </p>
        {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          className="mt-2 block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-bg"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            setFiles(multiple ? picked : picked.slice(0, 1));
          }}
        />
        {status ? (
          <p className="mt-2 text-xs font-semibold text-accent">{status}</p>
        ) : null}
      </div>

      {files.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {previews.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.url}
                src={p.url}
                alt={p.name}
                className="h-20 w-28 rounded-lg object-cover"
              />
            ))}
          </div>
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-2 text-xs text-ink-soft"
              >
                <span className="truncate">
                  {file.name}
                  <span className="text-ink-muted">
                    {" "}
                    · {(file.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-ink-muted hover:text-danger"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          {files.length > 0 ? (
            <button
              type="button"
              className="text-xs font-semibold text-ink-muted hover:text-ink"
              onClick={() => setFiles([])}
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
