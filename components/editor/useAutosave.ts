"use client";

import { useEffect, type RefObject } from "react";
import { repo } from "@/lib/storage/repo";
import { startAutosave, workspaceStore } from "@/lib/store/workspace";

/**
 * Keeps the open workspace on disk. `startAutosave` debounces and never overlaps saves, but its
 * disposer only drops the timer, so this also writes any unsaved edit when the editor goes away.
 */
export function useAutosave(thumbnail: RefObject<string | undefined>): void {
  useEffect(() => {
    let unsaved = false;

    const stopAutosave = startAutosave(async (ws) => {
      await repo.saveWorkspace(ws, thumbnail.current);
      // An edit may have landed while that was in flight; it still needs writing.
      if (workspaceStore.getState().workspace === ws) unsaved = false;
    });

    const unsubscribe = workspaceStore.subscribe((state, prev) => {
      const next = state.workspace;
      if (next === null || next === prev.workspace) return;
      if (prev.workspace?.id === next.id) unsaved = true;
    });

    const flush = () => {
      const ws = workspaceStore.getState().workspace;
      if (!unsaved || ws === null) return;
      unsaved = false;
      void repo.saveWorkspace(ws, thumbnail.current);
    };

    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      stopAutosave();
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [thumbnail]);
}
