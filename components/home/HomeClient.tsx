"use client";

import { useCallback } from "react";
import { DropZone } from "@/components/home/DropZone";
import { RecentList } from "@/components/home/RecentList";
import { useOpenFiles } from "@/components/home/useOpenFiles";
import { StorageBanner } from "@/components/StorageBanner";

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
