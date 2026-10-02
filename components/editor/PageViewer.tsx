"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { zoomTo } from "@/components/editor/actions";
import { pageBox } from "@/components/editor/geometry";
import { PageView } from "@/components/editor/PageView";
import { useVisiblePage } from "@/components/editor/useVisiblePage";
import type { SourceDoc, SourceId, VirtualPage } from "@/lib/pdf/types";
import { MAX_ZOOM, MIN_ZOOM, editorStore, useEditor } from "@/lib/store/editor";
import { useWorkspace } from "@/lib/store/workspace";
import { dpr } from "@/lib/utils";

const PAD_X = 48;
const PAD_Y = 40;
/** Long enough that a drag of the zoom slider only renders once it settles. */
const RENDER_DELAY = 150;
const NO_PAGES: VirtualPage[] = [];

const clamp = (z: number): number => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => {
      setSize((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** The widest and tallest page on screen at scale 1: what a fit mode has to fit. */
const extentOf = (
  pages: VirtualPage[],
  sources: Record<SourceId, SourceDoc> | undefined,
): { width: number; height: number } =>
  pages.reduce(
    (largest, page) => {
      const box = pageBox(page, page.sourceId === null ? undefined : sources?.[page.sourceId], 1);
      return {
        width: Math.max(largest.width, box.width),
        height: Math.max(largest.height, box.height),
      };
    },
    { width: 1, height: 1 },
  );

interface PageViewerProps {
  onDisplayScale: (scale: number) => void;
  /** Offered by the properties popover on an image, and wired to the signature vault. */
  onSaveSignature?: (png: Uint8Array) => void;
}

export function PageViewer({ onDisplayScale, onSaveSignature }: PageViewerProps) {
  const pages = useWorkspace((s) => s.workspace?.pages) ?? NO_PAGES;
  const sources = useWorkspace((s) => s.workspace?.sources);
  const zoom = useEditor((s) => s.zoom);
  const zoomMode = useEditor((s) => s.zoomMode);
  const selectedPageIds = useEditor((s) => s.selectedPageIds);
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(ref);

  const extent = useMemo(() => extentOf(pages, sources), [pages, sources]);
  const order = useMemo(() => pages.map((page) => page.id), [pages]);

  const displayScale = useMemo(() => {
    if (zoomMode === "custom" || width === 0) return zoom;
    const fitWidth = (width - PAD_X * 2) / extent.width;
    if (zoomMode === "fit-width") return clamp(fitWidth);
    return clamp(Math.min(fitWidth, (height - PAD_Y * 2) / extent.height));
  }, [zoomMode, zoom, width, height, extent]);

  useEffect(() => {
    onDisplayScale(displayScale);
  }, [displayScale, onDisplayScale]);

  const renderScale = useSettled(displayScale, RENDER_DELAY) * dpr();
  const near = useVisiblePage(ref, pages);

  // React listens for wheel passively, so pinch-zoom needs its own listener to preventDefault.
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(displayScale * (1 - e.deltaY / 150));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [displayScale]);

  return (
    <div
      ref={ref}
      data-slot="page-viewer"
      className="relative flex-1 overflow-auto overscroll-contain bg-surface-sunken"
    >
      <div className="flex min-h-full w-max min-w-full flex-col items-center gap-7 px-12 py-10 pb-36">
        {pages.length === 0 ? (
          <p className="m-auto text-sm text-foreground-muted">
            This document has no pages left.
          </p>
        ) : (
          pages.map((page, index) => (
            <PageView
              key={page.id}
              page={page}
              index={index}
              source={page.sourceId === null ? undefined : sources?.[page.sourceId]}
              displayScale={displayScale}
              renderScale={renderScale}
              near={near.has(page.id)}
              selected={selectedPageIds.has(page.id)}
              onSelect={() => editorStore.getState().selectPage(page.id, "replace", order)}
              onSaveSignature={onSaveSignature}
            />
          ))
        )}
      </div>
    </div>
  );
}
