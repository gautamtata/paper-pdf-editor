"use client";

import type { PointerEvent } from "react";
import { applyMatrix, normalizeRect, type Matrix } from "@/lib/annotations/geometry";
import type { Rect } from "@/lib/annotations/types";

/** Which edges a handle drags, as fractions of the selection box; `0.5` leaves that axis alone. */
export interface Handle {
  id: string;
  fx: number;
  fy: number;
}

export const HANDLES: Handle[] = [
  { id: "x0y0", fx: 0, fy: 0 },
  { id: "x0y1", fx: 0, fy: 1 },
  { id: "x1y0", fx: 1, fy: 0 },
  { id: "x1y1", fx: 1, fy: 1 },
  { id: "x0", fx: 0, fy: 0.5 },
  { id: "x1", fx: 1, fy: 0.5 },
  { id: "y0", fx: 0.5, fy: 0 },
  { id: "y1", fx: 0.5, fy: 1 },
];

/** Nothing smaller stays grabbable, and a drag always resumes from the gesture's start box. */
const MIN_EXTENT = 2;

/** The box a handle drag produces, in PDF space, from the box the drag started on. */
export function handleRect(base: Rect, h: Handle, dx: number, dy: number): Rect {
  const r = normalizeRect(
    h.fx === 0 ? base.x + dx : base.x,
    h.fy === 0 ? base.y + dy : base.y,
    h.fx === 1 ? base.x + base.w + dx : base.x + base.w,
    h.fy === 1 ? base.y + base.h + dy : base.y + base.h,
  );
  return { ...r, w: Math.max(r.w, MIN_EXTENT), h: Math.max(r.h, MIN_EXTENT) };
}

/** A PDF-space rect as CSS pixels; page rotation keeps the box axis-aligned, so two corners do. */
export function screenBox(r: Rect, m: Matrix): Rect {
  const [x1, y1] = applyMatrix(m, r.x, r.y);
  const [x2, y2] = applyMatrix(m, r.x + r.w, r.y + r.h);
  return normalizeRect(x1, y1, x2, y2);
}

const SIZE = 7;
const HIT = 18;
/** Below this, the edge handles would sit on top of the corner ones, so only the corners show. */
const EDGE_MIN = 30;

const cursorFor = (px: number, py: number, box: Rect): string => {
  const dx = px - (box.x + box.w / 2);
  const dy = py - (box.y + box.h / 2);
  if (Math.abs(dx) < 1) return "ns-resize";
  if (Math.abs(dy) < 1) return "ew-resize";
  return dx * dy > 0 ? "nwse-resize" : "nesw-resize";
};

interface SelectionHandlesProps {
  /** The selected annotation's bounds in PDF space. */
  bounds: Rect;
  transform: Matrix;
  onHandleDown(h: Handle, e: PointerEvent<SVGElement>): void;
}

export function SelectionHandles({ bounds, transform, onHandleDown }: SelectionHandlesProps) {
  const box = screenBox(bounds, transform);
  return (
    <g data-slot="selection" style={{ pointerEvents: "none" }}>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1}
      />
      {HANDLES.filter(
        (h) => (h.fx !== 0.5 || box.w >= EDGE_MIN) && (h.fy !== 0.5 || box.h >= EDGE_MIN),
      ).map((h) => {
        const [px, py] = applyMatrix(transform, bounds.x + h.fx * bounds.w, bounds.y + h.fy * bounds.h);
        return (
          <g key={h.id} style={{ cursor: cursorFor(px, py, box), pointerEvents: "all" }}>
            <rect
              x={px - HIT / 2}
              y={py - HIT / 2}
              width={HIT}
              height={HIT}
              fill="transparent"
              onPointerDown={(e) => onHandleDown(h, e)}
            />
            <rect
              x={px - SIZE / 2}
              y={py - SIZE / 2}
              width={SIZE}
              height={SIZE}
              rx={1.5}
              fill="var(--surface)"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
    </g>
  );
}
