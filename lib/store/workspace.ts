import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Annotation } from "@/lib/annotations/types";
import * as ops from "@/lib/pdf/ops";
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

/** Snapshots kept in `past`; one per undoable action. */
const HISTORY_LIMIT = 100;

export interface WorkspaceState {
  workspace: Workspace | null;
  past: VirtualPage[][];
  future: VirtualPage[][];
  /**
   * The pages as they were before the first transient `updateAnnotation` of the current gesture.
   * The committing update pushes this, so a whole drag costs one history entry.
   */
  gestureBase: VirtualPage[] | null;

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
  /** Drops the transient edits of the current gesture; no history entry, and a no-op without one. */
  cancelGesture(): void;

  /** Not undoable: history snapshots cover `pages` only. */
  rename(name: string): void;

  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

const pushSnapshot = (past: VirtualPage[][], pages: VirtualPage[]): VirtualPage[][] => [
  ...past.slice(-(HISTORY_LIMIT - 1)),
  pages,
];

/** `kind` and `id` are the annotation's identity, so a patch may never change them. */
const merge = (a: Annotation, patch: Partial<Annotation>): Annotation =>
  ({ ...a, ...patch, kind: a.kind, id: a.id }) as Annotation;

/** Replaces one page; returns `pages` unchanged when the id is unknown or `next` is a no-op. */
const mapPage = (
  pages: VirtualPage[],
  pageId: PageId,
  next: (page: VirtualPage) => VirtualPage,
): VirtualPage[] => {
  let changed = false;
  const out = pages.map((page) => {
    if (page.id !== pageId) return page;
    const updated = next(page);
    if (updated !== page) changed = true;
    return updated;
  });
  return changed ? out : pages;
};

const mapAnnotations =
  (id: string, next: (annotations: Annotation[]) => Annotation[]) =>
  (page: VirtualPage): VirtualPage => {
    if (!page.annotations.some((a) => a.id === id)) return page;
    return { ...page, annotations: next(page.annotations) };
  };

export const workspaceStore = createStore<WorkspaceState>()((set, get) => {
  /**
   * Applies an undoable edit: records one history entry and bumps `updatedAt`. Returning the
   * workspace itself from `next` means "nothing changed" and leaves the store alone.
   */
  const edit = (next: (ws: Workspace) => Workspace): void => {
    const { workspace, past } = get();
    if (workspace === null) return;
    const updated = next(workspace);
    if (updated === workspace) return;
    set({
      workspace: { ...updated, updatedAt: Date.now() },
      past: pushSnapshot(past, workspace.pages),
      future: [],
      gestureBase: null,
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
    pageId: PageId,
    next: (page: VirtualPage) => VirtualPage,
    transient: boolean,
  ): void => {
    const { workspace, gestureBase, past } = get();
    if (workspace === null) return;
    const pages = mapPage(workspace.pages, pageId, next);
    if (pages === workspace.pages) return;
    const updated = { ...workspace, pages, updatedAt: Date.now() };
    if (transient) {
      set({ workspace: updated, gestureBase: gestureBase ?? workspace.pages });
      return;
    }
    set({
      workspace: updated,
      past: pushSnapshot(past, gestureBase ?? workspace.pages),
      future: [],
      gestureBase: null,
    });
  };

  return {
    workspace: null,
    past: [],
    future: [],
    gestureBase: null,

    load: (workspace) => set({ workspace, past: [], future: [], gestureBase: null }),

    create: (name, sources) => {
      const workspace: Workspace = {
        id: newId(),
        name,
        sources: Object.fromEntries(sources.map((src) => [src.id, src])),
        pages: sources.flatMap(pagesFromSource),
        updatedAt: Date.now(),
      };
      set({ workspace, past: [], future: [], gestureBase: null });
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
        pageId,
        (page) => ({ ...page, annotations: [...page.annotations, a] }),
        opts?.transient === true,
      ),

    updateAnnotation: (pageId, id, patch, opts) =>
      editAnnotations(
        pageId,
        mapAnnotations(id, (annotations) =>
          annotations.map((a) => (a.id === id ? merge(a, patch) : a)),
        ),
        opts?.transient === true,
      ),

    cancelGesture: () => {
      const { workspace, gestureBase } = get();
      if (workspace === null || gestureBase === null) return;
      set({
        workspace: { ...workspace, pages: gestureBase, updatedAt: Date.now() },
        gestureBase: null,
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
