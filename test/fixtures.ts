import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import {
  newId,
  pagesFromSource,
  type Rotation,
  type SourceDoc,
  type Workspace,
} from "@/lib/pdf/types";

export { makeOffsetPdf, makePdf, makeRotatedPdf } from "@/test/pdf-fixtures";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

/** A committed PDF whose trailer references a standard-security `/Encrypt` dict. */
export async function makeEncryptedPdf(): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path.join(fixtureDir, "encrypted.pdf")));
}

/**
 * A workspace of `pageCount` pages over one source whose bytes are never parsed: for UI tests
 * that mock the renderer. Page i is 400+i x 600pt, matching `makePdf`.
 */
export function makeWorkspace(pageCount: number, name = "doc"): Workspace {
  const source: SourceDoc = {
    id: newId(),
    name: `${name}.pdf`,
    bytes: new Uint8Array(0),
    pageCount,
    pages: Array.from({ length: pageCount }, (_, i) => ({
      size: { w: 400 + i, h: 600 },
      rotation: 0 as Rotation,
    })),
  };
  return {
    id: newId(),
    name,
    sources: { [source.id]: source },
    pages: pagesFromSource(source),
    updatedAt: Date.now(),
  };
}

export const GARBAGE = new TextEncoder().encode("not a pdf at all");

/** A 1x1 PNG. */
export const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

/** The decoded content stream operators of one page of a loaded document. */
export function pageContent(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  return refs
    .map((obj) => doc.context.lookup(obj))
    .filter((obj): obj is PDFRawStream => obj instanceof PDFRawStream)
    .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
    .join("\n");
}
