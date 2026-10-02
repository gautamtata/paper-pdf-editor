"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { repo } from "@/lib/storage/repo";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";

/** Placeholder shell: Task 10 replaces this with the real editor. */
export function EditorShell({ workspaceId }: { workspaceId: string }) {
  const [missing, setMissing] = useState(false);
  const workspace = useWorkspace((s) => s.workspace);

  useEffect(() => {
    // The store already holds it when we arrive straight from creating it.
    if (workspaceStore.getState().workspace?.id === workspaceId) return;
    let cancelled = false;
    repo
      .getWorkspace(workspaceId)
      .then((ws) => {
        if (cancelled) return;
        if (ws === undefined) {
          setMissing(true);
          return;
        }
        workspaceStore.getState().load(ws);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const open = workspace?.id === workspaceId ? workspace : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      {open === null ? null : (
        <p className="text-sm text-foreground">
          {open.name} · {open.pages.length} pages
        </p>
      )}
      {missing && open === null ? (
        <p className="text-sm text-foreground-muted">Not found</p>
      ) : null}
      <Link
        href="/"
        className="rounded-xs text-xs text-foreground-subtle underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground"
      >
        Back to Paper
      </Link>
    </main>
  );
}
