"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pageBox, totalRotation } from "@/components/editor/geometry";
import { isAbortError } from "@/components/editor/usePageCanvas";
import { renderPage } from "@/lib/render/renderer";
import { useWorkspace } from "@/lib/store/workspace";

const THUMB_WIDTH = 160;
const JPEG_QUALITY = 0.7;

/**
 * A small JPEG of page one, for the card on the home page. Kept in a ref because autosave reads
 * it as it saves rather than rendering on its own; regenerated whenever page one changes.
 */
export function useAutosaveThumbnail(): RefObject<string | undefined> {
  const thumbnail = useRef<string | undefined>(undefined);
  const first = useWorkspace((s) => s.workspace?.pages[0]);
  const sources = useWorkspace((s) => s.workspace?.sources);

  const source =
    first === undefined || first.sourceId === null ? undefined : sources?.[first.sourceId];
  const pageId = first?.id;
  const pageIndex = first?.sourceIndex ?? 0;
  const rotation = first === undefined ? undefined : totalRotation(first, source);
  const naturalWidth = first === undefined ? 0 : pageBox(first, source, 1).width;

  useEffect(() => {
    if (source === undefined || rotation === undefined || naturalWidth <= 0) return;
    const controller = new AbortController();
    renderPage(
      { source, pageIndex, rotation, scale: THUMB_WIDTH / naturalWidth },
      controller.signal,
    )
      .then((rendered) => {
        if (controller.signal.aborted) return;
        const canvas = document.createElement("canvas");
        canvas.width = rendered.canvas.width;
        canvas.height = rendered.canvas.height;
        const ctx = canvas.getContext("2d");
        if (ctx === null) return;
        // JPEG has no alpha, so transparent pixels would come out black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(rendered.canvas, 0, 0);
        thumbnail.current = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) console.error(err);
      });
    return () => controller.abort();
  }, [source, pageIndex, rotation, naturalWidth, pageId]);

  return thumbnail;
}
