"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { loadPdfFiles } from "@/lib/pdf/open-files";
import { repo } from "@/lib/storage/repo";
import { workspaceStore } from "@/lib/store/workspace";

/** Names the workspace after the documents that actually opened. */
export const nameFrom = (names: string[]): string => {
  const first = (names[0] ?? "Untitled").replace(/\.pdf$/i, "");
  return names.length > 1 ? `${first} + ${names.length - 1} more` : first;
};

export interface OpenFiles {
  open(files: File[]): Promise<void>;
  busy: boolean;
}

/** Turns picked PDFs (already filtered by the drop zone) into a saved workspace and opens it. */
export function useOpenFiles(): OpenFiles {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // A ref, not `busy`: a second drop arriving in the same tick would still see
  // the stale state and create a second workspace.
  const running = useRef(false);

  const open = useCallback(
    async (files: File[]): Promise<void> => {
      if (files.length === 0 || running.current) return;
      running.current = true;

      setBusy(true);
      try {
        const sources = await loadPdfFiles(files);
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
        running.current = false;
        setBusy(false);
      }
    },
    [router],
  );

  return { open, busy };
}
