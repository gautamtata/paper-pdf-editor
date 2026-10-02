"use client";

import { TriangleAlert } from "lucide-react";
import { useSyncExternalStore } from "react";
import { repo } from "@/lib/storage/repo";

/** Server-rendered as "not full": the quota is only known in the browser. */
const neverOnServer = () => false;

/** Shown wherever work can be lost: the device refused to keep this document. */
export function StorageBanner() {
  const memoryOnly = useSyncExternalStore(repo.onModeChange, repo.isMemoryOnly, neverOnServer);

  if (!memoryOnly) return null;
  return (
    <p
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-surface-raised px-6 py-2 text-xs text-foreground-muted"
    >
      <TriangleAlert className="size-3.5 shrink-0 text-danger" aria-hidden />
      Storage is full — changes will be lost when you close this tab
    </p>
  );
}
