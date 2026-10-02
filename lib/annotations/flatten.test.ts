import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { flattenAnnotations, type FlattenContext } from "@/lib/annotations/flatten";
import {
  createHighlight,
  createImage,
  createInk,
  createRect,
  createText,
  type Annotation,
} from "@/lib/annotations/types";
import { pageContent, TINY_PNG } from "@/test/fixtures";

async function flattened(annotations: Annotation[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ctx: FlattenContext = { doc, font, imageCache: new Map() };
  await flattenAnnotations(page, annotations, ctx);
  const saved = await PDFDocument.load(await doc.save());
  return { doc, page, ctx, ops: pageContent(saved, 0), saved };
}

const RED = { r: 1, g: 0, b: 0 };

describe("flattenAnnotations", () => {
  it("draws an image XObject for image annotations", async () => {
    const image = createImage({ x: 10, y: 10, w: 100, h: 50 }, TINY_PNG, 2);
    const { page, ctx, ops } = await flattened([image]);
    const xobj = page.node.Resources()?.lookup(PDFName.of("XObject"));
    expect(xobj).toBeDefined();
    expect(xobj!.toString()).toContain("Image");
    expect(ops).toContain("1 0 0 1 10 10 cm");
    expect(ops).toContain("100 0 0 50 0 0 cm");
    expect(ctx.imageCache.get(image.id)).toBeDefined();
  });

  it("embeds a png once per annotation id", async () => {
    const image = createImage({ x: 0, y: 0, w: 10, h: 5 }, TINY_PNG, 2);
    const { page, ctx } = await flattened([image, image]);
    expect(ctx.imageCache.size).toBe(1);
    const xobj = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    const refs = xobj!.entries().map(([, ref]) => ref.toString());
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(1);
  });

  it("writes text, rect, highlight and ink into the content stream", async () => {
    const { page, ops } = await flattened([
      createText({ x: 20, y: 500, w: 200, h: 40 }, { content: "hello", fontSize: 12, color: RED }),
      createRect({ x: 10, y: 20, w: 100, h: 50 }, { strokeWidth: 3, fill: RED }),
      createHighlight({ x: 5, y: 6, w: 70, h: 8 }),
      createInk(
        [
          [
            { x: 100, y: 100, p: 0.5 },
            { x: 150, y: 120, p: 0.5 },
            { x: 200, y: 100, p: 0.5 },
          ],
        ],
        RED,
        4,
      ),
    ]);
    expect(ops).toContain("Tj");
    expect(ops).toContain("1 0 0 1 20 528 Tm");
    expect(ops).toContain("1 0 0 1 10 20 cm");
    expect(ops).toContain("100 50 l");
    expect(ops).toContain("1 0 0 1 5 6 cm");
    expect(ops).toContain("70 8 l");
    expect(ops).toMatch(/ l$/m);
    const gs = page.node.Resources()?.lookup(PDFName.of("ExtGState"));
    expect(gs!.toString()).toContain("/Multiply");
  });

  it("flips ink into PDF space from a y-down SVG origin at the top-left", async () => {
    const { ops } = await flattened([createInk([[{ x: 100, y: 100, p: 0.5 }]], RED, 4)]);
    expect(ops).toContain("1 0 0 1 0 600 cm");
    expect(ops).toContain("1 0 0 -1 0 0 cm");
    expect(ops).toMatch(/\b(9\d|10\d)(\.\d+)? 50\d(\.\d+)? l/);
  });

  it("replaces characters Helvetica cannot encode instead of throwing", async () => {
    const { ops } = await flattened([
      createText({ x: 0, y: 0, w: 300, h: 20 }, { content: "ok \u{1F600} é" }),
    ]);
    expect(ops).toContain("Tj");
    expect(ops).toContain("<6F6B203F20E9> Tj");
  });

  it("draws nothing for an empty list", async () => {
    const { ops } = await flattened([]);
    expect(ops).toBe("");
  });
});
