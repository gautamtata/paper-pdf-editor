import type { Workspace } from "@/lib/pdf/types";
import { workspaceStore } from "@/lib/store/workspace";

/**
 * Debounced persistence of workspace edits. Loads and creates are skipped (they are not changes),
 * saves never overlap, and a save queued while one is in flight collapses into a single later save.
 */
export function startAutosave(
  save: (ws: Workspace) => Promise<void>,
  debounceMs = 500,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let pending: Workspace | null = null;

  const drain = async (): Promise<void> => {
    while (pending !== null) {
      const ws = pending;
      pending = null;
      try {
        await save(ws);
      } catch (error) {
        console.error("autosave failed", error);
      }
    }
    inFlight = null;
  };

  const flush = (): void => {
    timer = null;
    pending = workspaceStore.getState().workspace;
    if (pending === null || inFlight !== null) return;
    inFlight = drain();
  };

  const unsubscribe = workspaceStore.subscribe((state, prev) => {
    const next = state.workspace;
    if (next === null || next === prev.workspace) return;
    // A different (or first) workspace id means a load/create, not an edit worth saving.
    if (prev.workspace === null || prev.workspace.id !== next.id) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  });

  return () => {
    unsubscribe();
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
