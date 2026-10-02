import {
  addRotation,
  newId,
  pagesFromSource,
  Rotation,
  type PageId,
  type PageSize,
  type SourceDoc,
  type SourceId,
  type VirtualPage,
} from "@/lib/pdf/types";

const clampIndex = (index: number, max: number): number =>
  Math.min(Math.max(Math.trunc(index), 0), max);

const insertAt = (
  pages: VirtualPage[],
  index: number,
  inserted: VirtualPage[],
): VirtualPage[] => {
  const at = clampIndex(index, pages.length);
  return [...pages.slice(0, at), ...inserted, ...pages.slice(at)];
};

/** A detached copy of `page`: fresh page id, deep-copied annotations with fresh ids. */
const copyPage = (page: VirtualPage): VirtualPage => {
  const annotations = structuredClone(page.annotations);
  for (const annotation of annotations) annotation.id = newId();
  return { ...page, id: newId(), size: { ...page.size }, annotations };
};

export function deletePages(pages: VirtualPage[], ids: Iterable<PageId>): VirtualPage[] {
  const selected = new Set(ids);
  return pages.filter((page) => !selected.has(page.id));
}

/**
 * Removes the selected pages (keeping their relative order) and reinserts the block so its
 * first page lands at `toIndex`, measured against the array after removal and clamped to it.
 */
export function movePages(
  pages: VirtualPage[],
  ids: Iterable<PageId>,
  toIndex: number,
): VirtualPage[] {
  const selected = new Set(ids);
  const moving = pages.filter((page) => selected.has(page.id));
  if (moving.length === 0) return pages.slice();
  const remaining = pages.filter((page) => !selected.has(page.id));
  return insertAt(remaining, toIndex, moving);
}

export function rotatePages(
  pages: VirtualPage[],
  ids: Iterable<PageId>,
  delta: Rotation,
): VirtualPage[] {
  const selected = new Set(ids);
  return pages.map((page) =>
    selected.has(page.id) ? { ...page, rotation: addRotation(page.rotation, delta) } : page,
  );
}

export function duplicatePages(pages: VirtualPage[], ids: Iterable<PageId>): VirtualPage[] {
  const selected = new Set(ids);
  const out: VirtualPage[] = [];
  for (const page of pages) {
    out.push(page);
    if (selected.has(page.id)) out.push(copyPage(page));
  }
  return out;
}

export function insertBlank(
  pages: VirtualPage[],
  atIndex: number,
  size: PageSize,
): VirtualPage[] {
  const blank: VirtualPage = {
    id: newId(),
    sourceId: null,
    sourceIndex: 0,
    rotation: Rotation.R0,
    size: { ...size },
    annotations: [],
  };
  return insertAt(pages, atIndex, [blank]);
}

export function appendSource(
  pages: VirtualPage[],
  src: SourceDoc,
  atIndex: number = pages.length,
): VirtualPage[] {
  return insertAt(pages, atIndex, pagesFromSource(src));
}

/** The selected pages in their current order, detached from `pages`. */
export function extractPages(pages: VirtualPage[], ids: Iterable<PageId>): VirtualPage[] {
  const selected = new Set(ids);
  return pages.filter((page) => selected.has(page.id)).map(copyPage);
}

export function usedSourceIds(pages: VirtualPage[]): Set<SourceId> {
  const used = new Set<SourceId>();
  for (const page of pages) {
    if (page.sourceId !== null) used.add(page.sourceId);
  }
  return used;
}
