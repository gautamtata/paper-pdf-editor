import { degrees, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { loadSource, PdfLoadError } from "@/lib/pdf/load";
import { pagesFromSource, Rotation } from "@/lib/pdf/types";
import { GARBAGE, makeEncryptedPdf, makePdf, pageContent } from "@/test/fixtures";

describe("loadSource", () => {
  it("parses page count and sizes", async () => {
    const src = await loadSource("a.pdf", await makePdf(3));
    expect(src.pageCount).toBe(3);
    expect(src.pages.map((p) => p.size.w)).toEqual([400, 401, 402]);
    expect(src.pages.map((p) => p.size.h)).toEqual([600, 600, 600]);
    expect(src.pages[0].rotation).toBe(Rotation.R0);
    expect(src.name).toBe("a.pdf");
    expect(src.id).toHaveLength(10);
  });

  it("normalizes the intrinsic /Rotate of each source page", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]).setRotation(degrees(450));
    doc.addPage([400, 600]).setRotation(degrees(-90));
    const src = await loadSource("r.pdf", await doc.save());
    expect(src.pages.map((p) => p.rotation)).toEqual([Rotation.R90, Rotation.R270]);
    // Sizes stay MediaBox sizes, never rotation-adjusted.
    expect(src.pages[0].size).toEqual({ w: 400, h: 600 });
  });

  it("rejects encrypted", async () => {
    await expect(loadSource("e.pdf", await makeEncryptedPdf())).rejects.toMatchObject({
      reason: "encrypted",
      fileName: "e.pdf",
    });
  });

  it("reports a document that parses but has unreadable page geometry", async () => {
    // pdf-lib resolves MediaBox and Rotate lazily, with type assertions that
    // throw well after `load` has returned.
    const noBox = await PDFDocument.create();
    noBox.addPage([400, 600]).node.delete(PDFName.of("MediaBox"));
    await expect(loadSource("b.pdf", await noBox.save())).rejects.toMatchObject({
      reason: "malformed",
      fileName: "b.pdf",
    });

    const badRotate = await PDFDocument.create();
    badRotate.addPage([400, 600]).node.set(PDFName.of("Rotate"), PDFName.of("Bogus"));
    await expect(loadSource("r.pdf", await badRotate.save())).rejects.toBeInstanceOf(PdfLoadError);
  });

  it("rejects garbage", async () => {
    await expect(loadSource("g.pdf", GARBAGE)).rejects.toBeInstanceOf(PdfLoadError);
    await expect(loadSource("g.pdf", GARBAGE)).rejects.toMatchObject({ reason: "malformed" });
  });

  it("pagesFromSource builds one virtual page per source page", async () => {
    const src = await loadSource("a.pdf", await makePdf(2));
    const pages = pagesFromSource(src);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toMatchObject({
      sourceId: src.id,
      sourceIndex: 1,
      rotation: Rotation.R0,
      size: { w: 401, h: 600 },
      annotations: [],
    });
    expect(new Set(pages.map((p) => p.id)).size).toBe(2);
  });
});

describe("encrypted fixture", () => {
  // pdf-lib's EncryptedPDFError is downlevelled to ES5 and loses its prototype
  // chain, so it can only be recognised by its message, never by `instanceof`.
  it("makes pdf-lib refuse the document as encrypted", async () => {
    const bytes = await makeEncryptedPdf();
    await expect(PDFDocument.load(bytes)).rejects.toThrow(/is encrypted/);
    const forced = await PDFDocument.load(bytes, { ignoreEncryption: true });
    expect(forced.isEncrypted).toBe(true);
  });
});

/** pdf-lib writes shown text as an upper-case hex string literal. */
const hexLiteral = (text: string): string => {
  const hex = [...text].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return `<${hex.toUpperCase()}>`;
};

describe("makePdf", () => {
  it("labels every page so later render/export tests can identify it", async () => {
    const doc = await PDFDocument.load(await makePdf(2, "mine"));
    expect(pageContent(doc, 0)).toContain(`${hexLiteral("mine-p0")} Tj`);
    expect(pageContent(doc, 1)).toContain(`${hexLiteral("mine-p1")} Tj`);
    expect(pageContent(doc, 0)).toContain("1 0 0 1 40 560 Tm");
  });
});
