import { describe, expect, it } from "vitest";
import {
  applyMatrix,
  clampRect,
  invertMatrix,
  matrixToCss,
  normalizeRect,
  rectContains,
  type Matrix,
} from "@/lib/annotations/geometry";

const FLIP: Matrix = [2, 0, 0, -2, 0, 400];

describe("applyMatrix / invertMatrix", () => {
  it("applies and inverts a y-flip matrix like pdf.js at scale 2, rotation 0 on a 100x200 page", () => {
    expect(applyMatrix(FLIP, 10, 20)).toEqual([20, 360]);
    const [x, y] = applyMatrix(invertMatrix(FLIP), 20, 360);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(20);
  });

  it("round-trips a rotated matrix", () => {
    // pdf.js viewport.transform for rotation 90 at scale 1 on a 100x200 page.
    const rotated: Matrix = [0, 1, 1, 0, 0, 0];
    const [px, py] = applyMatrix(rotated, 10, 20);
    expect([px, py]).toEqual([20, 10]);
    const [x, y] = applyMatrix(invertMatrix(rotated), px, py);
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(20);
  });

  it("rejects a singular matrix", () => {
    expect(() => invertMatrix([0, 0, 0, 0, 5, 5])).toThrow(/singular/i);
  });
});

describe("matrixToCss", () => {
  it("emits a CSS matrix() in [a,b,c,d,e,f] order", () => {
    expect(matrixToCss(FLIP)).toBe("matrix(2,0,0,-2,0,400)");
  });
});

describe("normalizeRect", () => {
  it("normalizeRect from any corners", () => {
    expect(normalizeRect(5, 9, 1, 3)).toEqual({ x: 1, y: 3, w: 4, h: 6 });
  });

  it("keeps already-ordered corners and allows zero extent", () => {
    expect(normalizeRect(1, 3, 5, 9)).toEqual({ x: 1, y: 3, w: 4, h: 6 });
    expect(normalizeRect(2, 2, 2, 2)).toEqual({ x: 2, y: 2, w: 0, h: 0 });
  });
});

describe("rectContains", () => {
  const r = { x: 10, y: 10, w: 20, h: 5 };

  it("includes the interior and the edges", () => {
    expect(rectContains(r, 15, 12)).toBe(true);
    expect(rectContains(r, 10, 10)).toBe(true);
    expect(rectContains(r, 30, 15)).toBe(true);
  });

  it("excludes points outside", () => {
    expect(rectContains(r, 9.5, 12)).toBe(false);
    expect(rectContains(r, 15, 16)).toBe(false);
  });
});

describe("clampRect", () => {
  it("clampRect keeps rect inside page", () => {
    expect(clampRect({ x: -5, y: 0, w: 50, h: 10 }, { w: 40, h: 40 })).toEqual({
      x: 0,
      y: 0,
      w: 40,
      h: 10,
    });
  });

  it("shifts a fitting rect back inside the page", () => {
    expect(clampRect({ x: 35, y: -5, w: 10, h: 10 }, { w: 40, h: 40 })).toEqual({
      x: 30,
      y: 0,
      w: 10,
      h: 10,
    });
  });

  it("leaves a rect already inside alone and returns a copy", () => {
    const r = { x: 5, y: 5, w: 10, h: 10 };
    const out = clampRect(r, { w: 40, h: 40 });
    expect(out).toEqual(r);
    expect(out).not.toBe(r);
  });
});
