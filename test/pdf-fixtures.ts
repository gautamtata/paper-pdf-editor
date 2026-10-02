import { degrees, PDFDocument, StandardFonts } from "pdf-lib";
import type { Rotation } from "@/lib/pdf/types";

/**
 * PDF builders that lean on nothing but pdf-lib — no `import.meta`, no app modules — so the
 * Playwright specs can feed the browser the same bytes the unit suite uses.
 */

/** Page i is 400+i x 600pt and carries the text `${label}-p${i}` at (40, 560). */
export async function makePdf(pageCount: number, label = "doc"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400 + i, 600]);
    page.drawText(`${label}-p${i}`, { x: 40, y: 560, size: 14, font });
  }
  return doc.save();
}

/** Like `makePdf`, but every page carries an intrinsic `/Rotate` of `rotation`. */
export async function makeRotatedPdf(rotation: Rotation, pageCount = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400 + i, 600]);
    page.drawText(`rot-p${i}`, { x: 40, y: 560, size: 14, font });
    page.setRotation(degrees(rotation));
  }
  return doc.save();
}

/** One 400x600 page whose MediaBox is `[100 100 500 700]`, i.e. user space does not start at 0. */
export async function makeOffsetPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 600]).setMediaBox(100, 100, 400, 600);
  return doc.save();
}
