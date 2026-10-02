import { toast } from "sonner";
import { loadPdfFiles } from "@/lib/pdf/open-files";
import type { PageId, Rotation } from "@/lib/pdf/types";
import { repo } from "@/lib/storage/repo";
import { MAX_ZOOM, MIN_ZOOM, editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { isPdfFile } from "@/lib/utils";

/** The one place page edits are spelled out, so the toolbar, menus, palette and keys agree. */

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

export const pageOrder = (): PageId[] =>
  workspaceStore.getState().workspace?.pages.map((page) => page.id) ?? [];

/** The selection in page order, so a moved or rotated block keeps the order it reads in. */
export function selectedInOrder(): PageId[] {
  const { selectedPageIds } = editorStore.getState();
  return pageOrder().filter((id) => selectedPageIds.has(id));
}

export function rotateSelected(delta: Rotation): void {
  const ids = selectedInOrder();
  if (ids.length > 0) workspaceStore.getState().rotatePages(ids, delta);
}

export function deleteSelected(): void {
  const ids = selectedInOrder();
  if (ids.length === 0) return;
  workspaceStore.getState().deletePages(ids);
  editorStore.getState().clearSelection();
  toast.success(`Deleted ${plural(ids.length, "page")}`, {
    action: { label: "Undo", onClick: () => workspaceStore.getState().undo() },
  });
}

export function duplicateSelected(): void {
  const ids = selectedInOrder();
  if (ids.length > 0) workspaceStore.getState().duplicatePages(ids);
}

export function insertBlankAfter(pageId: PageId): void {
  const { workspace, insertBlank } = workspaceStore.getState();
  const page = workspace?.pages.find((p) => p.id === pageId);
  if (page === undefined) return;
  insertBlank(pageOrder().indexOf(pageId) + 1, page.size);
}

/** Opens the extracted pages in a new tab; the current document is left untouched. */
export async function extractSelected(): Promise<void> {
  const ids = selectedInOrder();
  const { workspace, extractToWorkspace } = workspaceStore.getState();
  if (ids.length === 0 || workspace === null) return;
  const extracted = extractToWorkspace(ids, `${workspace.name} (extract)`);
  try {
    await repo.saveWorkspace(extracted);
  } catch (err) {
    console.error(err);
    toast.error("Couldn't save the extracted pages");
    return;
  }
  window.open(`/edit/${extracted.id}`, "_blank");
  toast.success(`Extracted ${plural(ids.length, "page")} to a new document`);
}

/** Merges picked PDFs into the open document, inserting at `atIndex` (default: at the end). */
export async function addFiles(files: File[], atIndex?: number): Promise<void> {
  const pdfs = files.filter(isPdfFile);
  if (pdfs.length < files.length) toast.error("Only PDF files are supported");
  if (pdfs.length === 0) return;
  const sources = await loadPdfFiles(pdfs);
  if (sources.length === 0) return;
  workspaceStore.getState().addSources(sources, atIndex);
  const added = sources.reduce((total, src) => total + src.pageCount, 0);
  toast.success(`Added ${plural(added, "page")}`);
}

export function scrollToPage(id: PageId): void {
  const page = document.querySelector(`[data-page-id="${id}"]`);
  page?.scrollIntoView({ block: "start", behavior: "smooth" });
}

const clampZoom = (z: number): number => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

/** Steps away from the scale on screen, so zooming out of a fit mode starts where the eye is. */
export function zoomIn(from: number): void {
  editorStore.getState().setZoom(ZOOM_STEPS.find((step) => step > from + 0.005) ?? MAX_ZOOM);
}

export function zoomOut(from: number): void {
  const steps = [...ZOOM_STEPS].reverse();
  editorStore.getState().setZoom(steps.find((step) => step < from - 0.005) ?? MIN_ZOOM);
}

export function zoomTo(scale: number): void {
  editorStore.getState().setZoom(clampZoom(scale));
}
