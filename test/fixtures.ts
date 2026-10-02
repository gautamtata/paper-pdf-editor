import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

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

/** A committed PDF whose trailer references a standard-security `/Encrypt` dict. */
export async function makeEncryptedPdf(): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(fixtureDir, "encrypted.pdf")));
}

export const GARBAGE = new TextEncoder().encode("not a pdf at all");
