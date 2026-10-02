import { nanoid } from "nanoid";
import type { Annotation } from "@/lib/annotations/types";

/** Clockwise page rotation in degrees. */
export enum Rotation {
  R0 = 0,
  R90 = 90,
  R180 = 180,
  R270 = 270,
}

export type SourceId = string;
export type PageId = string;
export type WorkspaceId = string;

/** Dimensions in PDF user space points. */
export interface PageSize {
  w: number;
  h: number;
}

export interface SourcePageInfo {
  /** MediaBox size, not adjusted for rotation. */
  size: PageSize;
  /** The source page's intrinsic `/Rotate`. */
  rotation: Rotation;
}

export interface SourceDoc {
  id: SourceId;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pages: SourcePageInfo[];
}

export interface VirtualPage {
  id: PageId;
  /** `null` for pages not backed by a source document (e.g. blank pages). */
  sourceId: SourceId | null;
  sourceIndex: number;
  /** Rotation applied on top of the source page's intrinsic rotation. */
  rotation: Rotation;
  size: PageSize;
  annotations: Annotation[];
}

export interface Workspace {
  id: WorkspaceId;
  name: string;
  sources: Record<SourceId, SourceDoc>;
  pages: VirtualPage[];
  updatedAt: number;
}

export const newId = (): string => nanoid(10);

/** Snaps any degree value (negative, >= 360, off-quadrant) onto the enum. */
export const normalizeRotation = (degrees: number): Rotation => {
  const quarters = ((Math.round(degrees / 90) % 4) + 4) % 4;
  return (quarters * 90) as Rotation;
};

export const addRotation = (a: Rotation, b: Rotation): Rotation => normalizeRotation(a + b);

export function pagesFromSource(src: SourceDoc): VirtualPage[] {
  return src.pages.map((page, sourceIndex) => ({
    id: newId(),
    sourceId: src.id,
    sourceIndex,
    rotation: Rotation.R0,
    size: page.size,
    annotations: [],
  }));
}
