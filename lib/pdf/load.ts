import { PDFDocument } from "pdf-lib";
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
  let doc: PDFDocument;
  try {
    // We detect encryption via `isEncrypted` rather than catching pdf-lib's
    // EncryptedPDFError: its error classes are downlevelled to ES5, which
    // breaks their prototype chain, so `instanceof` never matches.
    doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    throw new PdfLoadError("malformed", name);
  }
  if (doc.isEncrypted) throw new PdfLoadError("encrypted", name);

  const pages: SourcePageInfo[] = doc.getPages().map((page) => {
    const { width, height } = page.getSize();
    return {
      size: { w: width, h: height },
      rotation: normalizeRotation(page.getRotation().angle),
    };
  });

  return { id: newId(), name, bytes, pageCount: pages.length, pages };
}
