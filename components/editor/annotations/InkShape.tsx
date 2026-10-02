"use client";

import { useMemo, type PointerEvent } from "react";
import { strokeToPath } from "@/lib/annotations/ink";
import { rgbToCss, type InkAnnotation } from "@/lib/annotations/types";

interface InkShapeProps {
  a: InkAnnotation;
  interactive: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
}

export function InkShape({ a, interactive, onPointerDown }: InkShapeProps) {
  const paths = useMemo(
    () => a.strokes.map((stroke) => strokeToPath(stroke, a.size)).filter((d) => d !== ""),
    [a.strokes, a.size],
  );
  const fill = rgbToCss(a.color);
  return (
    <g
      data-annotation-id={a.id}
      style={{
        pointerEvents: interactive ? "visiblePainted" : "none",
        cursor: interactive ? "move" : undefined,
      }}
      onPointerDown={onPointerDown}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} fill={fill} />
      ))}
    </g>
  );
}
