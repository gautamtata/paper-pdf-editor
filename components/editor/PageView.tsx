"use client";

import { memo } from "react";
import { AnnotationLayer } from "@/components/editor/AnnotationLayer";
import { pageBox, pageTransform, totalRotation } from "@/components/editor/geometry";
import { RenderFailed } from "@/components/editor/RenderFailed";
import { usePageCanvas } from "@/components/editor/usePageCanvas";
import type { PageId, SourceDoc, VirtualPage } from "@/lib/pdf/types";
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
  onSelect: (id: PageId) => void;
  onSaveSignature?: (png: Uint8Array) => void;
}

/** Memoised: a drag on one page replaces the pages array every frame, and the rest must not re-render. */
export const PageView = memo(function PageView({
  page,
  index,
  source,
  displayScale,
  renderScale,
  near,
  selected,
  onSelect,
  onSaveSignature,
}: PageViewProps) {
  const box = pageBox(page, source, displayScale);
  const transform = pageTransform(page, source, displayScale);
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  const { canvasRef, painted, failed, retry } = usePageCanvas({
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
        onClick={() => onSelect(page.id)}
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
        <AnnotationLayer
          page={page}
          transform={transform}
          width={width}
          height={height}
          onSaveSignature={onSaveSignature}
        />
        {failed ? <RenderFailed onRetry={retry} /> : null}
      </div>
      <span className="mt-2 mb-1 text-[0.6875rem] tabular-nums text-foreground-subtle">
        {index + 1}
      </span>
    </div>
  );
});
