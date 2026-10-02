"use client";

import { useEffect, useState, type RefObject } from "react";
import type { PageId } from "@/lib/pdf/types";
import { editorStore } from "@/lib/store/editor";

/** One viewport of lead-in, so a page is painted before it scrolls into view. */
const RENDER_MARGIN = "100% 0px";
const AREA_STEPS = [0, 0.05, 0.25, 0.5, 0.75, 1];

const sameIds = (a: Set<PageId>, b: Set<PageId>): boolean =>
  a.size === b.size && [...a].every((id) => b.has(id));

const pageIdOf = (target: Element): PageId | null => target.getAttribute("data-page-id");

/**
 * The pages worth rendering, and upkeep of `activePageId` (the page filling most of the viewer).
 * Two observers because the render margin inflates the root, which would skew visible area; both
 * only wake on threshold crossings, so scrolling itself costs nothing.
 */
export function useVisiblePage(
  containerRef: RefObject<HTMLElement | null>,
  order: PageId[],
): Set<PageId> {
  const [near, setNear] = useState<Set<PageId>>(new Set());

  useEffect(() => {
    const root = containerRef.current;
    if (root === null || order.length === 0) return;

    const nearIds = new Set<PageId>();
    const renderObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = pageIdOf(entry.target);
          if (id === null) continue;
          if (entry.isIntersecting) nearIds.add(id);
          else nearIds.delete(id);
        }
        setNear((prev) => (sameIds(prev, nearIds) ? prev : new Set(nearIds)));
      },
      { root, rootMargin: RENDER_MARGIN },
    );

    const areas = new Map<PageId, number>();
    const activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = pageIdOf(entry.target);
          if (id === null) continue;
          areas.set(id, entry.intersectionRatio * entry.boundingClientRect.height);
        }
        let best: PageId | null = null;
        let bestArea = 0;
        for (const [id, area] of areas) {
          if (area > bestArea) {
            best = id;
            bestArea = area;
          }
        }
        const { activePageId, setActivePage } = editorStore.getState();
        if (best !== null && best !== activePageId) setActivePage(best);
      },
      { root, threshold: AREA_STEPS },
    );

    for (const id of order) {
      const el = root.querySelector(`[data-page-id="${id}"]`);
      if (el === null) continue;
      renderObserver.observe(el);
      activeObserver.observe(el);
    }
    return () => {
      renderObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [containerRef, order]);

  return near;
}
