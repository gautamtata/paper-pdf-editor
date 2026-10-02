"use client";

import { AnnotationLayer } from "@/components/editor/AnnotationLayer";
import { pageBox, pageTransform, totalRotation } from "@/components/editor/geometry";
import { usePageCanvas } from "@/components/editor/usePageCanvas";
import type { SourceDoc, VirtualPage } from "@/lib/pdf/types";
import { cn } from "@/lib/utils";

interface PageViewProps {
  page: VirtualPage;
  index: number;
  source: SourceDoc | undefined;
  /** CSS scale: the box is sized from this before the render resolves. */
  displayScale: number;
  /** Render scale, including devicePixelRatio and debounced behind the zoom. */
  renderScale: number;
  near: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function PageView({
  page,
  index,
  source,
  displayScale,
  renderScale,
  near,
  selected,
  onSelect,
}: PageViewProps) {
  const box = pageBox(page, source, displayScale);
  const transform = pageTransform(page, source, displayScale);
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  const { canvasRef, painted } = usePageCanvas({
    source,
    pageIndex: page.sourceIndex,
    rotation: totalRotation(page, source),
    scale: renderScale,
    enabled: near,
  });

  return (
    <div className="flex flex-col items-center">
      <div
        data-testid="page"
        data-page-id={page.id}
        aria-label={`Page ${index + 1}`}
        style={{ width, height }}
        onClick={onSelect}
        className={cn(
          "relative scroll-mt-6 overflow-hidden bg-white shadow-page",
          "outline-2 outline-offset-[3px] outline-transparent transition-[outline-color]",
          selected && "outline-accent",
        )}
      >
        {page.sourceId === null ? null : (
          <canvas
            ref={canvasRef}
            style={{ width, height }}
            className={cn("block transition-opacity", painted ? "opacity-100" : "opacity-0")}
          />
        )}
        <AnnotationLayer page={page} transform={transform} width={width} height={height} />
      </div>
      <span className="mt-2 mb-1 text-[0.6875rem] tabular-nums text-foreground-subtle">
        {index + 1}
      </span>
    </div>
  );
}
