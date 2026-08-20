"use client";

import { useState, useTransition } from "react";
import { createRevitToken, revokeRevitToken } from "@/lib/actions/revit-tokens";
import { Button, Input, Label } from "@/components/ui";

export type RevitTokenRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function RevitConnect({ tokens }: { tokens: RevitTokenRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [freshToken, setFreshToken] = useState("");

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {freshToken ? (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Copy this now — it won&apos;t be shown again
          </p>
          <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-ink">
            {freshToken}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(freshToken)}
            >
              Copy token
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFreshToken("")}>
              I&apos;ve saved it
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          setError("");
          start(async () => {
            try {
              const token = await createRevitToken(fd);
              setFreshToken(token);
              form.reset();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create token");
            }
          });
        }}
      >
        <div className="min-w-[220px] flex-1">
          <Label>Token name</Label>
          <Input name="name" placeholder="Revit on my machine" defaultValue="Revit" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Revit token"}
        </Button>
      </form>

      <ul className="divide-y divide-line rounded-xl border border-line bg-white/70">
        {tokens.length === 0 ? (
          <li className="px-4 py-6 text-sm text-ink-soft">
            No tokens yet. Create one, then paste it into the Revit Settings button.
          </li>
        ) : (
          tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{token.name}</p>
                <p className="text-xs text-ink-muted">
                  {token.prefix}… · created {new Date(token.createdAt).toLocaleString()}
                  {token.lastUsedAt
                    ? ` · last used ${new Date(token.lastUsedAt).toLocaleString()}`
                    : " · never used"}
                </p>
              </div>
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() => {
                  setError("");
                  start(async () => {
                    try {
                      await revokeRevitToken(token.id);
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Could not revoke token",
                      );
                    }
                  });
                }}
              >
                Revoke
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
