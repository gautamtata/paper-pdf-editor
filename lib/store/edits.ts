import type { Annotation } from "@/lib/annotations/types";
import type { PageId, VirtualPage } from "@/lib/pdf/types";

/** Snapshots kept in `past`; one per undoable action. */
const HISTORY_LIMIT = 100;

/** Which annotation a gesture belongs to, so a cancel cannot drop an edit someone else started. */
export interface GestureOwner {
  pageId: PageId;
  id: string;
}

export const EMPTY_HISTORY = {
  past: [] as VirtualPage[][],
  future: [] as VirtualPage[][],
  gestureBase: null,
  gestureOwner: null,
};

export const sameOwner = (a: GestureOwner | null, b: GestureOwner): boolean =>
  a !== null && a.pageId === b.pageId && a.id === b.id;

export const pushSnapshot = (past: VirtualPage[][], pages: VirtualPage[]): VirtualPage[][] => [
  ...past.slice(-(HISTORY_LIMIT - 1)),
  pages,
];

/** `kind` and `id` are the annotation's identity, so a patch may never change them. */
export const merge = (a: Annotation, patch: Partial<Annotation>): Annotation =>
  ({ ...a, ...patch, kind: a.kind, id: a.id }) as Annotation;

/** Replaces one page; returns `pages` unchanged when the id is unknown or `next` is a no-op. */
export const mapPage = (
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

export const mapAnnotations =
  (id: string, next: (annotations: Annotation[]) => Annotation[]) =>
  (page: VirtualPage): VirtualPage => {
    if (!page.annotations.some((a) => a.id === id)) return page;
    return { ...page, annotations: next(page.annotations) };
  };
