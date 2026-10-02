import type { PageSize } from "@/lib/pdf/types";
import type { Rect } from "@/lib/annotations/types";

/** pdf.js `viewport.transform` layout: `x' = a*x + c*y + e`, `y' = b*x + d*y + f`. */
export type Matrix = [number, number, number, number, number, number];

export const applyMatrix = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

export const invertMatrix = (m: Matrix): Matrix => {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) throw new Error("invertMatrix: singular matrix");
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
};

export const matrixToCss = (m: Matrix): string => `matrix(${m.join(",")})`;

/** Any two corners to a rect with non-negative extent. */
export const normalizeRect = (x1: number, y1: number, x2: number, y2: number): Rect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  w: Math.abs(x2 - x1),
  h: Math.abs(y2 - y1),
});

/** Edge-inclusive hit test. */
export const rectContains = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

/** Shifts `r` inside the page, shrinking it first if it is larger than the page. */
export const clampRect = (r: Rect, page: PageSize): Rect => {
  const w = Math.min(r.w, page.w);
  const h = Math.min(r.h, page.h);
  return { x: clamp(r.x, 0, page.w - w), y: clamp(r.y, 0, page.h - h), w, h };
};
