"use client";

import type { PointerEvent } from "react";
import {
  AnnotationKind,
  rgbToCss,
  type HighlightAnnotation,
  type RectAnnotation,
} from "@/lib/annotations/types";

interface RectShapeProps {
  a: RectAnnotation | HighlightAnnotation;
  interactive: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
}

/** Highlights multiply, matching the blend mode the export flattens them with. */
const paintOf = (a: RectAnnotation | HighlightAnnotation) =>
  a.kind === AnnotationKind.Highlight
    ? {
        fill: rgbToCss(a.color),
        fillOpacity: a.opacity,
        stroke: "none",
        strokeWidth: 0,
        blend: "multiply" as const,
      }
    : {
        fill: a.fill === null ? "none" : rgbToCss(a.fill),
        fillOpacity: 1,
        stroke: rgbToCss(a.strokeColor),
        strokeWidth: a.strokeWidth,
        blend: undefined,
      };

export function RectShape({ a, interactive, onPointerDown }: RectShapeProps) {
  const paint = paintOf(a);
  return (
    <rect
      data-annotation-id={a.id}
      x={a.rect.x}
      y={a.rect.y}
      width={a.rect.w}
      height={a.rect.h}
      fill={paint.fill}
      fillOpacity={paint.fillOpacity}
      stroke={paint.stroke}
      strokeWidth={paint.strokeWidth}
      style={{
        mixBlendMode: paint.blend,
        pointerEvents: interactive ? "all" : "none",
        cursor: interactive ? "move" : undefined,
      }}
      onPointerDown={onPointerDown}
    />
  );
}
