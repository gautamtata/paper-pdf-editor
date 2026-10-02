import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { createImage, createRect } from "@/lib/annotations/types";
import { exportWorkspace } from "@/lib/pdf/export";
import { loadSource } from "@/lib/pdf/load";
import { deletePages, duplicatePages, insertBlank, movePages } from "@/lib/pdf/ops";
import { pagesFromSource, Rotation, type SourceDoc, type Workspace } from "@/lib/pdf/types";
import {
  GARBAGE,
  makeCroppedPdf,
  makeOffsetPdf,
  makePdf,
  makeRotatedPdf,
  pageContent,
  TINY_PNG,
} from "@/test/fixtures";

function wsOf(...sources: SourceDoc[]): Workspace {
  const ws: Workspace = { id: "ws", name: "Untitled", sources: {}, pages: [], updatedAt: 0 };
  for (const src of sources) {
    ws.sources[src.id] = src;
    ws.pages.push(...pagesFromSource(src));
  }
  return ws;
}

async function wsFrom(...docs: [string, number][]): Promise<Workspace> {
  const sources = await Promise.all(docs.map(([name, n]) => makePdf(n, name).then((b) => loadSource(`${name}.pdf`, b))));
  return wsOf(...sources);
}

const widths = (doc: PDFDocument) => doc.getPages().map((p) => p.getWidth());

describe("exportWorkspace", () => {
  it("merges two 5-page docs into 10 pages in order", async () => {
    const ws = await wsFrom(["a", 5], ["b", 5]);
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(out.getPageCount()).toBe(10);
    expect(widths(out)).toEqual([400, 401, 402, 403, 404, 400, 401, 402, 403, 404]);
  });

  it("deletes and reorders", async () => {
    const ws = await wsFrom(["a", 5]);
    const [, p1, , p3, p4] = ws.pages;
    ws.pages = movePages(deletePages(ws.pages, [p1.id, p3.id]), [p4.id], 0);
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(widths(out)).toEqual([404, 400, 402]);
  });

  it("applies rotation on top of the source's intrinsic rotation", async () => {
    const src = await loadSource("r.pdf", await makeRotatedPdf(Rotation.R90, 2));
    const ws = wsOf(src);
    ws.pages[0].rotation = Rotation.R90;
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([180, 90]);
    expect(widths(out)).toEqual([400, 401]);
  });

  it("inserts blank pages", async () => {
    const ws = await wsFrom(["a", 1]);
    ws.pages = insertBlank(ws.pages, 1, { w: 612, h: 792 });
    ws.pages[1].rotation = Rotation.R270;
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(out.getPageCount()).toBe(2);
    expect(out.getPage(1).getSize()).toEqual({ width: 612, height: 792 });
    expect(out.getPage(1).getRotation().angle).toBe(270);
    expect(pageContent(out, 1)).toBe("");
  });

  it("reports progress after every page", async () => {
    const ws = await wsFrom(["a", 3]);
    const calls: [number, number][] = [];
    await exportWorkspace(ws, (done, total) => calls.push([done, total]));
    expect(calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("round-trips: exporting the export of a merged doc gives the same sizes", async () => {
    const first = await exportWorkspace(await wsFrom(["a", 2], ["b", 3]));
    const ws = wsOf(await loadSource("first.pdf", first));
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(widths(out)).toEqual([400, 401, 400, 401, 402]);
  });

  it("flattens annotations onto copied pages without transforming for /Rotate", async () => {
    const src = await loadSource("r.pdf", await makeRotatedPdf(Rotation.R90));
    const ws = wsOf(src);
    ws.pages[0].rotation = Rotation.R90;
    ws.pages[0].annotations = [createRect({ x: 10, y: 20, w: 100, h: 50 })];
    const out = await PDFDocument.load(await exportWorkspace(ws));
    const ops = pageContent(out, 0);
    expect(ops).toContain("1 0 0 1 10 20 cm");
    expect(ops).toContain("100 50 l");
  });

  it("offsets drawings by a non-zero MediaBox origin", async () => {
    const src = await loadSource("off.pdf", await makeOffsetPdf());
    const ws = wsOf(src);
    ws.pages[0].annotations = [createImage({ x: 10, y: 10, w: 100, h: 50 }, TINY_PNG, 2)];
    const out = await PDFDocument.load(await exportWorkspace(ws));
    const ops = pageContent(out, 0);
    expect(ops).toContain("1 0 0 1 110 110 cm");
    expect(ops).toContain("100 0 0 50 0 0 cm");
  });

  it("offsets drawings by the CropBox origin, the box the page is displayed in", async () => {
    const src = await loadSource("crop.pdf", await makeCroppedPdf());
    const ws = wsOf(src);
    expect(ws.pages[0].size).toEqual({ w: 300, h: 500 });
    ws.pages[0].annotations = [createImage({ x: 10, y: 10, w: 100, h: 50 }, TINY_PNG, 2)];
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(pageContent(out, 0)).toContain("1 0 0 1 60 60 cm");
  });

  it("rejects with the source name when a source cannot be read", async () => {
    const good = await loadSource("good.pdf", await makePdf(1));
    const ws = wsOf(good, { ...good, id: "bad", name: "bad.pdf", bytes: GARBAGE });
    await expect(exportWorkspace(ws)).rejects.toThrow("Couldn't read bad.pdf");
  });

  it("never mutates the workspace or the source bytes", async () => {
    const ws = await wsFrom(["a", 2]);
    ws.pages[0].rotation = Rotation.R90;
    ws.pages[1].annotations = [createRect({ x: 1, y: 2, w: 3, h: 4 })];
    const before = structuredClone(ws);
    await exportWorkspace(ws);
    expect(ws).toEqual(before);
  });

  it.skipIf(process.env.CI)("exports 200 pages in under 5 s", async () => {
    const ws = await wsFrom(["big", 200]);
    const started = performance.now();
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(performance.now() - started).toBeLessThan(5000);
    expect(out.getPageCount()).toBe(200);
  });
});

describe("exportWorkspace shares resources per source", () => {
  const fontObjects = (doc: PDFDocument): number =>
    doc.context
      .enumerateIndirectObjects()
      .filter(([, obj]) => obj instanceof PDFDict && obj.get(PDFName.of("Type")) === PDFName.of("Font"))
      .length;

  it("embeds a source's shared font once however many of its pages are exported", async () => {
    const ws = await wsFrom(["a", 5]);
    const out = await PDFDocument.load(await exportWorkspace(ws), { updateMetadata: false });
    // The source's Helvetica plus the one the exporter embeds for text annotations.
    expect(fontObjects(out)).toBe(2);
    const one = await exportWorkspace({ ...ws, pages: ws.pages.slice(0, 1) });
    const five = await exportWorkspace(ws);
    expect(five.byteLength).toBeLessThan(one.byteLength * 2);
  });

  it("gives a duplicated page its own content so annotations stay apart", async () => {
    const ws = await wsFrom(["a", 2]);
    ws.pages = duplicatePages(ws.pages, [ws.pages[0].id]);
    ws.pages[0].annotations = [createRect({ x: 10, y: 20, w: 100, h: 50 })];
    ws.pages[1].rotation = Rotation.R90;
    const out = await PDFDocument.load(await exportWorkspace(ws));
    expect(widths(out)).toEqual([400, 400, 401]);
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0]);
    expect(pageContent(out, 0)).toContain("100 50 l");
    expect(pageContent(out, 1)).not.toContain("100 50 l");
    expect(pageContent(out, 1)).toContain("Tj");
    expect(fontObjects(out)).toBe(2);
  });
});
