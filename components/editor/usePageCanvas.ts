"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Rotation, SourceDoc } from "@/lib/pdf/types";
import { renderPage } from "@/lib/render/renderer";

/** A render we cancelled ourselves, from either the renderer or pdf.js. */
export const isAbortError = (err: unknown): boolean =>
  err instanceof Error &&
  (err.name === "AbortError" || err.name === "RenderingCancelledException");

interface PageCanvasRequest {
  source: SourceDoc | undefined;
  pageIndex: number;
  /** Total rotation: the source page's intrinsic `/Rotate` plus the virtual page's. */
  rotation: Rotation;
  /** Includes devicePixelRatio. */
  scale: number;
  enabled: boolean;
}

/**
 * Paints a page into a canvas this component owns. The renderer hands out canvases from its
 * cache, which two cards showing the same source page would otherwise fight over. Copying also
 * leaves the previous bitmap in place until the next one resolves, so a zoom never flashes empty.
 */
export function usePageCanvas({
  source,
  pageIndex,
  rotation,
  scale,
  enabled,
}: PageCanvasRequest): { canvasRef: RefObject<HTMLCanvasElement | null>; painted: boolean } {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (!enabled || source === undefined || scale <= 0) return;
    const controller = new AbortController();
    renderPage({ source, pageIndex, rotation, scale }, controller.signal)
      .then((rendered) => {
        const canvas = canvasRef.current;
        if (canvas === null || controller.signal.aborted) return;
        canvas.width = rendered.canvas.width;
        canvas.height = rendered.canvas.height;
        // Absent outside a browser (jsdom has no 2d backend); the box still lays out.
        canvas.getContext("2d")?.drawImage(rendered.canvas, 0, 0);
        setPainted(true);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) console.error(err);
      });
    return () => controller.abort();
  }, [source, pageIndex, rotation, scale, enabled]);

  return { canvasRef, painted };
}
