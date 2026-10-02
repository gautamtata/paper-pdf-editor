"use client";

import { Download } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { plural } from "@/components/editor/actions";
import { Hint } from "@/components/editor/Hint";
import { Button } from "@/components/ui/button";
import { useModKey } from "@/components/ui/kbd";
import { exportWorkspace } from "@/lib/pdf/export";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";
import { downloadBytes } from "@/lib/utils";

/** One toast for the whole run, so progress replaces itself instead of stacking up. */
const TOAST_ID = "export";
const EVERY_PAGES = 10;
const EVERY_MS = 100;

/** Characters no common filesystem accepts, plus the leading dots that would hide the file. */
const UNSAFE = /[\\/:*?"<>|\x00-\x1f]/g;

export function exportFilename(name: string): string {
  const base = name
    .replace(/\.pdf$/i, "")
    .replace(UNSAFE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  return base.length === 0 ? "document.pdf" : `${base}.pdf`;
}

export interface Exporter {
  exportNow(): Promise<void>;
  running: boolean;
}

/**
 * The one export: the toolbar button, the command palette and ⌘E all call this, and a second call
 * while one is in flight is dropped.
 */
export function useExport(): Exporter {
  const [running, setRunning] = useState(false);
  // A ref, not `running`: a keystroke in the same tick as a click would still see the stale state.
  const inFlight = useRef(false);

  const exportNow = useCallback(async (): Promise<void> => {
    const ws = workspaceStore.getState().workspace;
    if (inFlight.current || ws === null || ws.pages.length === 0) return;
    inFlight.current = true;
    setRunning(true);
    toast.loading("Exporting…", { id: TOAST_ID });

    let shownAt = 0;
    let shownPage = 0;
    try {
      const bytes = await exportWorkspace(ws, (done, total) => {
        const now = Date.now();
        if (done < total && done - shownPage < EVERY_PAGES && now - shownAt < EVERY_MS) return;
        shownPage = done;
        shownAt = now;
        toast.loading(`Exporting page ${done} of ${total}`, { id: TOAST_ID });
      });
      downloadBytes(bytes, exportFilename(ws.name));
      toast.success(`Exported ${plural(ws.pages.length, "page")}`, { id: TOAST_ID });
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Couldn't export this document";
      toast.error(message, { id: TOAST_ID });
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  }, []);

  return { exportNow, running };
}

interface ExportButtonProps {
  onExport: () => void;
  running: boolean;
}

export function ExportButton({ onExport, running }: ExportButtonProps) {
  const empty = useWorkspace((s) => (s.workspace?.pages.length ?? 0) === 0);
  const mod = useModKey();

  return (
    <Hint label="Export" keys={`${mod}E`}>
      <Button
        size="sm"
        data-testid="export-button"
        disabled={running || empty}
        className="h-8 shrink-0 rounded-full"
        onClick={onExport}
      >
        <Download className="size-4" />
        {running ? "Exporting…" : "Export"}
      </Button>
    </Hint>
  );
}
