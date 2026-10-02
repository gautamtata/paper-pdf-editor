import { addRotation, Rotation, type SourceDoc, type VirtualPage } from "@/lib/pdf/types";
import { getViewportSize } from "@/lib/render/renderer";

/** The source page's own `/Rotate`; `R0` for blank pages and while a source is missing. */
export const intrinsicRotation = (page: VirtualPage, source: SourceDoc | undefined): Rotation =>
  source?.pages[page.sourceIndex]?.rotation ?? Rotation.R0;

/** What the renderer needs: intrinsic rotation plus the rotation the user applied. */
export const totalRotation = (page: VirtualPage, source: SourceDoc | undefined): Rotation =>
  addRotation(intrinsicRotation(page, source), page.rotation);

/**
 * The on-screen box of a page at `scale`, known before any render resolves, so boxes are laid
 * out first and filled in after.
 */
export const pageBox = (
  page: VirtualPage,
  source: SourceDoc | undefined,
  scale: number,
): { width: number; height: number } =>
  getViewportSize(page.size, intrinsicRotation(page, source), page.rotation, scale);
