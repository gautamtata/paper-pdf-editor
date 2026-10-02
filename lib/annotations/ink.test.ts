import { describe, expect, it } from "vitest";
import { strokeBounds, strokeToPath } from "@/lib/annotations/ink";
import type { InkPoint } from "@/lib/annotations/types";

const PTS: InkPoint[] = [
  { x: 0, y: 0, p: 0.5 },
  { x: 10, y: 5, p: 0.5 },
  { x: 20, y: 0, p: 0.5 },
];

describe("strokeToPath", () => {
  it("produces a closed path and bounds that contain the points", () => {
    const d = strokeToPath(PTS, 4);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    const b = strokeBounds(PTS, 4);
    expect(b.x).toBeLessThanOrEqual(0);
    expect(b.x + b.w).toBeGreaterThanOrEqual(20);
  });

  it("stays in the input coordinate space", () => {
    const coords = strokeToPath(PTS, 4)
      .match(/-?\d+(\.\d+)?/g)
      ?.map(Number);
    expect(coords?.length).toBeGreaterThan(6);
    expect(Math.min(...(coords ?? []))).toBeGreaterThanOrEqual(-10);
    expect(Math.max(...(coords ?? []))).toBeLessThanOrEqual(30);
  });

  it("draws a closed dot for a single point", () => {
    const d = strokeToPath([{ x: 5, y: 5, p: 0.5 }], 6);
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("returns an empty path for no points", () => {
    expect(strokeToPath([], 4)).toBe("");
  });

  it("honours real pressure instead of simulating it", () => {
    const pressured: InkPoint[] = [
      { x: 0, y: 0, p: 0.1 },
      { x: 10, y: 0, p: 1 },
      { x: 20, y: 0, p: 0.1 },
    ];
    const flat: InkPoint[] = pressured.map((p) => ({ ...p, p: 0.5 }));
    expect(strokeToPath(pressured, 10)).not.toBe(strokeToPath(flat, 10));
  });
});

describe("strokeBounds", () => {
  it("pads the point bbox by half the stroke size", () => {
    expect(strokeBounds(PTS, 4)).toEqual({ x: -2, y: -2, w: 24, h: 9 });
  });

  it("is a zero rect for no points", () => {
    expect(strokeBounds([], 4)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
