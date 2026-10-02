"use client";

import { useMemo, type PointerEvent } from "react";
import type { ImageAnnotation } from "@/lib/annotations/types";
import { pngDataUrl } from "@/lib/utils";

interface ImageShapeProps {
  a: ImageAnnotation;
  interactive: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
}

/** Images are drawn top-down, so the flipped page matrix is undone around the image's own box. */
export function ImageShape({ a, interactive, onPointerDown }: ImageShapeProps) {
  const href = useMemo(() => pngDataUrl(a.png), [a.png]);

  return (
    <g
      data-annotation-id={a.id}
      data-testid="annotation-image"
      transform={`translate(${a.rect.x}, ${a.rect.y + a.rect.h}) scale(1,-1)`}
      style={{
        pointerEvents: interactive ? "all" : "none",
        cursor: interactive ? "move" : undefined,
      }}
      onPointerDown={onPointerDown}
    >
      <image href={href} x={0} y={0} width={a.rect.w} height={a.rect.h} />
    </g>
  );
}
