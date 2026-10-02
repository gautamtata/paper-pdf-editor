import type { PDFPage } from "pdf-lib";

/** A page box in PDF user space; `x`/`y` is its bottom-left corner. */
export interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The box a page is displayed in: the CropBox clipped to the MediaBox, as pdf.js's `page.view`.
 * Falls back to the MediaBox when they do not overlap. Annotation space is this box, y-up, with
 * its origin at the box's bottom-left corner.
 */
export function displayBox(page: PDFPage): PageBox {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const x = Math.max(media.x, crop.x);
  const y = Math.max(media.y, crop.y);
  const width = Math.min(media.x + media.width, crop.x + crop.width) - x;
  const height = Math.min(media.y + media.height, crop.y + crop.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : media;
}
