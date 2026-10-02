import { getStroke } from "perfect-freehand";
import type { InkPoint, Rect } from "@/lib/annotations/types";

/** Pressure written by pointer events that report no real pressure. */
const FLAT_PRESSURE = 0.5;

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * A closed SVG path around `points`, in the same coordinate space as the input.
 * Empty for no points; a single point yields a dot.
 */
export function strokeToPath(points: InkPoint[], size: number): string {
  if (points.length === 0) return "";
  const outline = getStroke(
    points.map((p) => [p.x, p.y, p.p]),
    {
      size,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: points.every((p) => p.p === FLAT_PRESSURE),
    },
  );
  if (outline.length === 0) return "";
  const [[x0, y0], ...rest] = outline;
  const lines = rest.map(([x, y]) => `L ${round(x)} ${round(y)}`);
  return `M ${round(x0)} ${round(y0)} ${lines.join(" ")} Z`;
}

/** The bbox of the raw points, padded by `size / 2` on every side. */
export function strokeBounds(points: InkPoint[], size: number): Rect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const pad = size / 2;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + size, h: maxY - minY + size };
}
