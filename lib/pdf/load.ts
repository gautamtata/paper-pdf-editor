import { PDFDocument } from "pdf-lib";
import { displayBox } from "@/lib/pdf/box";
import { newId, normalizeRotation, type SourceDoc, type SourcePageInfo } from "@/lib/pdf/types";

export type PdfLoadReason = "encrypted" | "malformed";

const messageFor = (reason: PdfLoadReason, fileName: string): string =>
  reason === "encrypted" ? `${fileName} is password protected` : `Couldn't read ${fileName}`;

export class PdfLoadError extends Error {
  constructor(
    readonly reason: PdfLoadReason,
    readonly fileName: string,
  ) {
    super(messageFor(reason, fileName));
    this.name = "PdfLoadError";
  }
}

/** Parses `bytes` into a `SourceDoc`, or throws `PdfLoadError`. */
export async function loadSource(name: string, bytes: Uint8Array): Promise<SourceDoc> {
  let pages: SourcePageInfo[];
  try {
    // We detect encryption via `isEncrypted` rather than catching pdf-lib's
    // EncryptedPDFError: its error classes are downlevelled to ES5, which
    // breaks their prototype chain, so `instanceof` never matches.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    if (doc.isEncrypted) throw new PdfLoadError("encrypted", name);

    // Inside the try: pdf-lib resolves MediaBox and Rotate lazily, so a
    // document that loads can still throw raw assertion errors here.
    pages = doc.getPages().map((page) => {
      const { x, y, width, height } = displayBox(page);
      return {
        size: { w: width, h: height },
        origin: { x, y },
        rotation: normalizeRotation(page.getRotation().angle),
      };
    });
  } catch (err) {
    if (err instanceof PdfLoadError) throw err;
    throw new PdfLoadError("malformed", name);
  }

  return { id: newId(), name, bytes, pageCount: pages.length, pages };
}
