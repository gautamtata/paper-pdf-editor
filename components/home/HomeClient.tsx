"use client";

import { TriangleAlert } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { DropZone } from "@/components/home/DropZone";
import { RecentList } from "@/components/home/RecentList";
import { useOpenFiles } from "@/components/home/useOpenFiles";
import { repo } from "@/lib/storage/repo";

/** Server-rendered as "not full": the quota is only known in the browser. */
const neverOnServer = () => false;

function StorageBanner() {
  const memoryOnly = useSyncExternalStore(
    repo.onModeChange,
    repo.isMemoryOnly,
    neverOnServer,
  );

  if (!memoryOnly) return null;
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 border-b border-border bg-surface-raised px-6 py-2 text-xs text-foreground-muted"
    >
      <TriangleAlert className="size-3.5 shrink-0 text-danger" aria-hidden />
      Storage is full — changes will be lost when you close this tab
    </p>
  );
}

export function HomeClient() {
  const { open, busy } = useOpenFiles();
  // Stable, so the drop zone's document-level paste listener is attached once.
  const onFiles = useCallback((files: File[]) => void open(files), [open]);

  return (
    <main className="flex flex-1 flex-col">
      <StorageBanner />
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-20 sm:pt-28">
        <header className="text-center">
          <h1 className="font-hand text-[5.5rem] leading-[0.85] text-accent sm:text-[6.5rem]">
            Paper
          </h1>
          <p className="mx-auto mt-6 max-w-md text-pretty text-[0.9375rem] leading-relaxed text-foreground-muted">
            A private PDF editor. Your files never leave this device.
          </p>
        </header>

        <div className="mt-12">
          <DropZone onFiles={onFiles} busy={busy} />
        </div>

        <RecentList />
      </div>
    </main>
  );
}
