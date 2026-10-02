import { describe, expect, it } from "vitest";
import { strokeBounds } from "@/lib/annotations/ink";
import {
  AnnotationKind,
  annotationBounds,
  createHighlight,
  createImage,
  createInk,
  createRect,
  createText,
  hexToRgb,
  resizeAnnotation,
  rgbToCss,
  translateAnnotation,
  type InkPoint,
  type Rect,
} from "@/lib/annotations/types";

const RED = { r: 1, g: 0, b: 0 };
const RECT = { x: 10, y: 20, w: 100, h: 40 };
const STROKE: InkPoint[] = [
  { x: 0, y: 0, p: 0.5 },
  { x: 10, y: 10, p: 0.5 },
];

/** A stroke with extent on both axes, so a resize can exercise both scales. */
const CORNER: InkPoint[] = [
  { x: 0, y: 0, p: 0.5 },
  { x: 10, y: 0, p: 0.5 },
  { x: 10, y: 5, p: 0.5 },
];

const expectRectCloseTo = (got: Rect, want: Rect): void => {
  expect(got.x).toBeCloseTo(want.x, 10);
  expect(got.y).toBeCloseTo(want.y, 10);
  expect(got.w).toBeCloseTo(want.w, 10);
  expect(got.h).toBeCloseTo(want.h, 10);
};

describe("factories", () => {
  it("applies text defaults and a fresh id", () => {
    const a = createText(RECT);
    expect(a.kind).toBe(AnnotationKind.Text);
    expect(a.fontSize).toBe(14);
    expect(a.color).toEqual({ r: 0, g: 0, b: 0 });
    expect(a.content).toBe("");
    expect(a.id).toHaveLength(10);
    expect(createText(RECT).id).not.toBe(a.id);
  });

  it("honours text overrides", () => {
    const a = createText(RECT, { fontSize: 24, color: RED, content: "hi" });
    expect(a.fontSize).toBe(24);
    expect(a.color).toEqual(RED);
    expect(a.content).toBe("hi");
  });

  it("applies highlight and rect defaults", () => {
    const h = createHighlight(RECT);
    expect(h.color).toEqual({ r: 1, g: 0.9, b: 0.2 });
    expect(h.opacity).toBe(0.35);
    const r = createRect(RECT);
    expect(r.strokeColor).toEqual({ r: 0, g: 0, b: 0 });
    expect(r.strokeWidth).toBe(2);
    expect(r.fill).toBeNull();
    expect(createRect(RECT, { fill: RED, strokeWidth: 4 }).fill).toEqual(RED);
  });

  it("copies rects, colors and strokes so callers cannot mutate the annotation", () => {
    const rect = { ...RECT };
    const color = { ...RED };
    const strokes = [STROKE.map((p) => ({ ...p }))];
    const text = createText(rect, { color });
    const ink = createInk(strokes, color, 4);
    rect.x = 999;
    color.r = 0;
    strokes[0][0].x = 999;
    expect(text.rect.x).toBe(10);
    expect(text.color.r).toBe(1);
    expect(ink.color.r).toBe(1);
    expect(ink.strokes[0][0].x).toBe(0);
  });

  it("builds image annotations that survive structuredClone", () => {
    const a = createImage(RECT, new Uint8Array([137, 80, 78, 71]), 2.5);
    expect(a.aspect).toBe(2.5);
    const clone = structuredClone(a);
    expect(clone.png).toEqual(a.png);
    expect(clone).toEqual(a);
  });
});

describe("annotationBounds", () => {
  it("returns a copy of the rect for rect-shaped kinds", () => {
    for (const a of [createText(RECT), createHighlight(RECT), createRect(RECT), createImage(RECT, new Uint8Array(), 2.5)]) {
      const b = annotationBounds(a);
      expect(b).toEqual(RECT);
      expect(b).not.toBe(a.rect);
    }
  });

  it("unions the padded stroke bounds for ink", () => {
    const ink = createInk([STROKE, [{ x: 50, y: 5, p: 0.5 }]], RED, 4);
    const a = strokeBounds(ink.strokes[0], 4);
    const b = strokeBounds(ink.strokes[1], 4);
    expect(annotationBounds(ink)).toEqual({
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
      h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
    });
    expect(annotationBounds(ink)).toEqual({ x: -2, y: -2, w: 54, h: 14 });
  });

  it("ignores empty strokes and is a zero rect with no points at all", () => {
    expect(annotationBounds(createInk([[], STROKE], RED, 4))).toEqual({ x: -2, y: -2, w: 14, h: 14 });
    expect(annotationBounds(createInk([], RED, 4))).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("translateAnnotation", () => {
  it("moves the rect without touching the input", () => {
    const a = createHighlight(RECT);
    const moved = translateAnnotation(a, 5, -10);
    expect(moved.rect).toEqual({ x: 15, y: 10, w: 100, h: 40 });
    expect(moved.kind).toBe(AnnotationKind.Highlight);
    expect(moved.id).toBe(a.id);
    expect(a.rect).toEqual(RECT);
    expect(moved.rect).not.toBe(a.rect);
  });

  it("moves every ink point without touching the input", () => {
    const a = createInk([STROKE], RED, 4);
    const moved = translateAnnotation(a, 1, 2);
    expect(moved.strokes[0]).toEqual([
      { x: 1, y: 2, p: 0.5 },
      { x: 11, y: 12, p: 0.5 },
    ]);
    expect(a.strokes[0][0]).toEqual({ x: 0, y: 0, p: 0.5 });
    expect(moved.strokes).not.toBe(a.strokes);
  });
});

describe("resizeAnnotation", () => {
  const target = { x: 0, y: 0, w: 200, h: 80 };

  it("sets the rect for text, highlight and rect kinds", () => {
    expect(resizeAnnotation(createText(RECT), target).rect).toEqual(target);
    expect(resizeAnnotation(createHighlight(RECT), target).rect).toEqual(target);
    const resized = resizeAnnotation(createRect(RECT), target);
    expect(resized.rect).toEqual(target);
    expect(resized.rect).not.toBe(target);
  });

  it("keeps the image aspect by deriving h from w", () => {
    const a = createImage({ x: 0, y: 0, w: 100, h: 40 }, new Uint8Array(), 2.5);
    const resized = resizeAnnotation(a, { x: 7, y: 9, w: 50, h: 999 });
    expect(resized.rect).toEqual({ x: 7, y: 9, w: 50, h: 20 });
    expect(resized.rect.h).toBe(resized.rect.w / resized.aspect);
  });

  it("scales ink so its bounds become the requested rect", () => {
    const a = createInk([CORNER], RED, 4);
    expect(annotationBounds(a)).toEqual({ x: -2, y: -2, w: 14, h: 9 });
    const rect = { x: 0, y: 0, w: 28, h: 18 };
    const resized = resizeAnnotation(a, rect);
    expectRectCloseTo(annotationBounds(resized), rect);
    expect(resized.size).toBe(4);
    expect(a.strokes[0][1].x).toBe(10);
  });

  it("scales ink about the rect origin, inset by the stroke padding", () => {
    const resized = resizeAnnotation(createInk([CORNER], RED, 4), { x: 3, y: 7, w: 24, h: 14 });
    expect(resized.strokes[0]).toEqual([
      { x: 5, y: 9, p: 0.5 },
      { x: 25, y: 9, p: 0.5 },
      { x: 25, y: 19, p: 0.5 },
    ]);
  });

  it("is idempotent: resizing ink to the same rect twice does not drift", () => {
    const rect = { x: 3, y: 7, w: 24, h: 14 };
    const once = resizeAnnotation(createInk([CORNER], RED, 4), rect);
    const twice = resizeAnnotation(once, rect);
    expect(twice.strokes).toEqual(once.strokes);
    expectRectCloseTo(annotationBounds(twice), rect);
  });

  it("collapses rather than inverting ink when the rect is thinner than the stroke", () => {
    const resized = resizeAnnotation(createInk([CORNER], RED, 10), { x: 0, y: 0, w: 4, h: 4 });
    expect(resized.strokes[0]).toEqual([
      { x: 5, y: 5, p: 0.5 },
      { x: 5, y: 5, p: 0.5 },
      { x: 5, y: 5, p: 0.5 },
    ]);
    expect(annotationBounds(resized)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("leaves degenerate ink bounds unscaled", () => {
    const a = createInk([], RED, 4);
    expect(resizeAnnotation(a, target).strokes).toEqual([]);
    const dot = createInk([[{ x: 5, y: 5, p: 0.5 }]], RED, 0);
    expect(resizeAnnotation(dot, target).strokes[0][0]).toEqual({ x: 0, y: 0, p: 0.5 });
  });
});

describe("colors", () => {
  it("parses 6- and 3-digit hex", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb("ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb("#fff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#336699").g).toBeCloseTo(0x66 / 255);
  });

  it("rejects malformed hex", () => {
    expect(() => hexToRgb("#ff00")).toThrow(/hex/i);
    expect(() => hexToRgb("#gggggg")).toThrow(/hex/i);
  });

  it("formats css rgb with 0-255 integers", () => {
    expect(rgbToCss(RED)).toBe("rgb(255 0 0)");
    expect(rgbToCss({ r: 1, g: 0.9, b: 0.2 })).toBe("rgb(255 230 51)");
  });

  it("round-trips through hex", () => {
    expect(rgbToCss(hexToRgb("#336699"))).toBe("rgb(51 102 153)");
  });
});
