"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PdfLoadError, loadSource } from "@/lib/pdf/load";
import type { SourceDoc } from "@/lib/pdf/types";
import { repo } from "@/lib/storage/repo";
import { workspaceStore } from "@/lib/store/workspace";
import { isPdfFile } from "@/lib/utils";

/** Names the workspace after the documents that actually opened. */
export const nameFrom = (names: string[]): string => {
  const first = (names[0] ?? "Untitled").replace(/\.pdf$/i, "");
  return names.length > 1 ? `${first} + ${names.length - 1} more` : first;
};

export interface OpenFiles {
  open(files: File[]): Promise<void>;
  busy: boolean;
}

/** Turns picked files into a saved workspace and opens its editor. */
export function useOpenFiles(): OpenFiles {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = useCallback(
    async (files: File[]): Promise<void> => {
      const pdfs = files.filter(isPdfFile);
      if (pdfs.length < files.length) toast.error("Only PDF files are supported");
      if (pdfs.length === 0) return;

      setBusy(true);
      try {
        const sources: SourceDoc[] = [];
        for (const file of pdfs) {
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            sources.push(await loadSource(file.name, bytes));
          } catch (err) {
            if (err instanceof PdfLoadError) {
              toast.error(err.message);
            } else {
              console.error(err);
              toast.error(`Couldn't read ${file.name}`);
            }
          }
        }
        if (sources.length === 0) return;

        const ws = workspaceStore.getState().create(nameFrom(sources.map((s) => s.name)), sources);
        try {
          await repo.saveWorkspace(ws);
        } catch (err) {
          console.error(err);
          toast.error("Couldn't save this document on your device");
          return;
        }
        router.push(`/edit/${ws.id}`);
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return { open, busy };
}
