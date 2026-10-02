import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Annotation } from "@/lib/annotations/types";
import * as ops from "@/lib/pdf/ops";
import {
  EMPTY_HISTORY,
  mapAnnotations,
  mapPage,
  merge,
  pushSnapshot,
  sameOwner,
  type GestureOwner,
} from "@/lib/store/edits";
import {
  newId,
  pagesFromSource,
  type PageId,
  type PageSize,
  type Rotation,
  type SourceDoc,
  type SourceId,
  type VirtualPage,
  type Workspace,
} from "@/lib/pdf/types";

export type { GestureOwner } from "@/lib/store/edits";

export interface WorkspaceState {
  workspace: Workspace | null;
  past: VirtualPage[][];
  future: VirtualPage[][];
  /**
   * The pages as they were before the first transient `updateAnnotation` of the current gesture.
   * The committing update pushes this, so a whole drag costs one history entry.
   */
  gestureBase: VirtualPage[] | null;
  /** The annotation that armed `gestureBase`; the gesture is only ever this one's to cancel. */
  gestureOwner: GestureOwner | null;

  load(ws: Workspace): void;
  create(name: string, sources: SourceDoc[]): Workspace;
  addSources(sources: SourceDoc[], atIndex?: number): void;

  deletePages(ids: PageId[]): void;
  movePages(ids: PageId[], toIndex: number): void;
  rotatePages(ids: PageId[], delta: Rotation): void;
  duplicatePages(ids: PageId[]): void;
  insertBlank(atIndex: number, size: PageSize): void;
  /** A detached workspace built from `ids`; neither this workspace nor its history changes. */
  extractToWorkspace(ids: PageId[], name: string): Workspace;

  addAnnotation(pageId: PageId, a: Annotation, opts?: { transient?: boolean }): void;
  updateAnnotation(
    pageId: PageId,
    id: string,
    patch: Partial<Annotation>,
    opts?: { transient?: boolean },
  ): void;
  removeAnnotation(pageId: PageId, id: string): void;
  /**
   * Drops the transient edits of the current gesture; no history entry, and a no-op without one.
   * Passing an `owner` that does not hold the gesture makes it a no-op too.
   */
  cancelGesture(owner?: GestureOwner): void;

  /** Not undoable: history snapshots cover `pages` only. */
  rename(name: string): void;

  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export const workspaceStore = createStore<WorkspaceState>()((set, get) => {
  /**
   * Applies an undoable edit: records one history entry and bumps `updatedAt`. Returning the
   * workspace itself from `next` means "nothing changed" and leaves the store alone.
   */
  const edit = (next: (ws: Workspace) => Workspace): void => {
    const { workspace, past, gestureBase } = get();
    if (workspace === null) return;
    // Any other kind of edit abandons a half-made annotation rather than baking it into history.
    const current = gestureBase === null ? workspace : { ...workspace, pages: gestureBase };
    const updated = next(current);
    if (updated === current) return;
    set({
      workspace: { ...updated, updatedAt: Date.now() },
      past: pushSnapshot(past, current.pages),
      future: [],
      gestureBase: null,
      gestureOwner: null,
    });
  };

  const editPages = (next: (pages: VirtualPage[]) => VirtualPage[]): void =>
    edit((ws) => {
      const pages = next(ws.pages);
      return pages === ws.pages ? ws : { ...ws, pages };
    });

  /**
   * One annotation edit of a gesture. A transient edit only arms `gestureBase`; the committing one
   * pushes it, so a whole gesture — including the add that started it — costs one history entry.
   */
  const editAnnotations = (
    owner: GestureOwner,
    next: (page: VirtualPage) => VirtualPage,
    transient: boolean,
  ): void => {
    const { workspace, gestureBase, gestureOwner, past } = get();
    if (workspace === null) return;
    const pages = mapPage(workspace.pages, owner.pageId, next);
    if (pages === workspace.pages) return;
    const updated = { ...workspace, pages, updatedAt: Date.now() };
    if (transient) {
      // The first transient edit of a gesture owns it, so a later one cannot steal the cancel.
      set({
        workspace: updated,
        gestureBase: gestureBase ?? workspace.pages,
        gestureOwner: gestureOwner ?? owner,
      });
      return;
    }
    set({
      workspace: updated,
      past: pushSnapshot(past, gestureBase ?? workspace.pages),
      future: [],
      gestureBase: null,
      gestureOwner: null,
    });
  };

  return {
    workspace: null,
    past: [],
    future: [],
    gestureBase: null,
    gestureOwner: null,

    load: (workspace) => set({ ...EMPTY_HISTORY, workspace }),

    create: (name, sources) => {
      const workspace: Workspace = {
        id: newId(),
        name,
        sources: Object.fromEntries(sources.map((src) => [src.id, src])),
        pages: sources.flatMap(pagesFromSource),
        updatedAt: Date.now(),
      };
      set({ ...EMPTY_HISTORY, workspace });
      return workspace;
    },

    addSources: (sources, atIndex) =>
      edit((ws) => {
        if (sources.length === 0) return ws;
        const registered = { ...ws.sources };
        let pages = ws.pages;
        let at = atIndex ?? pages.length;
        for (const src of sources) {
          registered[src.id] = src;
          const before = pages.length;
          pages = ops.appendSource(pages, src, at);
          at += pages.length - before;
        }
        return { ...ws, sources: registered, pages };
      }),

    deletePages: (ids) => editPages((pages) => ops.deletePages(pages, ids)),
    movePages: (ids, toIndex) => editPages((pages) => ops.movePages(pages, ids, toIndex)),
    rotatePages: (ids, delta) => editPages((pages) => ops.rotatePages(pages, ids, delta)),
    duplicatePages: (ids) => editPages((pages) => ops.duplicatePages(pages, ids)),
    insertBlank: (atIndex, size) => editPages((pages) => ops.insertBlank(pages, atIndex, size)),

    extractToWorkspace: (ids, name) => {
      const { workspace } = get();
      const pages = workspace === null ? [] : ops.extractPages(workspace.pages, ids);
      const sources: Record<SourceId, SourceDoc> = {};
      for (const sourceId of ops.usedSourceIds(pages)) {
        const src = workspace?.sources[sourceId];
        if (src !== undefined) sources[sourceId] = src;
      }
      return { id: newId(), name, sources, pages, updatedAt: Date.now() };
    },

    addAnnotation: (pageId, a, opts) =>
      editAnnotations(
        { pageId, id: a.id },
        (page) => ({ ...page, annotations: [...page.annotations, a] }),
        opts?.transient === true,
      ),

    updateAnnotation: (pageId, id, patch, opts) =>
      editAnnotations(
        { pageId, id },
        mapAnnotations(id, (annotations) =>
          annotations.map((a) => (a.id === id ? merge(a, patch) : a)),
        ),
        opts?.transient === true,
      ),

    cancelGesture: (owner) => {
      const { workspace, gestureBase, gestureOwner } = get();
      if (workspace === null || gestureBase === null) return;
      if (owner !== undefined && !sameOwner(gestureOwner, owner)) return;
      set({
        workspace: { ...workspace, pages: gestureBase, updatedAt: Date.now() },
        gestureBase: null,
        gestureOwner: null,
      });
    },

    removeAnnotation: (pageId, id) =>
      editPages((pages) =>
        mapPage(
          pages,
          pageId,
          mapAnnotations(id, (annotations) => annotations.filter((a) => a.id !== id)),
        ),
      ),

    rename: (name) => {
      const { workspace } = get();
      if (workspace === null) return;
      set({ workspace: { ...workspace, name, updatedAt: Date.now() } });
    },

    undo: () => {
      const { workspace, past, future } = get();
      if (workspace === null || past.length === 0) return;
      set({
        workspace: { ...workspace, pages: past[past.length - 1], updatedAt: Date.now() },
        past: past.slice(0, -1),
        future: [...future, workspace.pages],
        gestureBase: null,
        gestureOwner: null,
      });
    },

    redo: () => {
      const { workspace, past, future } = get();
      if (workspace === null || future.length === 0) return;
      set({
        workspace: { ...workspace, pages: future[future.length - 1], updatedAt: Date.now() },
        past: pushSnapshot(past, workspace.pages),
        future: future.slice(0, -1),
        gestureBase: null,
        gestureOwner: null,
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

export const useWorkspace = <T>(selector: (s: WorkspaceState) => T): T =>
  useStore(workspaceStore, selector);

/** Re-exported so `workspace.ts` stays the one import site for workspace state helpers. */
export { startAutosave } from "@/lib/store/autosave";

export const selectPage =
  (id: PageId) =>
  (s: WorkspaceState): VirtualPage | undefined =>
    s.workspace?.pages.find((page) => page.id === id);
