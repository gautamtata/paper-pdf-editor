"use client";

import { useRef, useState, type DragEvent } from "react";
import { addFiles } from "@/components/editor/actions";
import type { PageId } from "@/lib/pdf/types";

const hasFiles = (e: DragEvent<HTMLElement>): boolean =>
  Array.from(e.dataTransfer?.types ?? []).includes("Files");

/** Which card the pointer released over, so dropped PDFs land after the page you aimed at. */
const indexUnder = (e: DragEvent<HTMLElement>, order: PageId[]): number | undefined => {
  const target = e.target instanceof Element ? e.target.closest("[data-page-card]") : null;
  const id = target?.getAttribute("data-page-card");
  if (id === null || id === undefined) return undefined;
  const at = order.indexOf(id);
  return at === -1 ? undefined : at + 1;
};

export interface RailDrop {
  dropping: boolean;
  dropHandlers: {
    onDragEnter: (e: DragEvent<HTMLElement>) => void;
    onDragOver: (e: DragEvent<HTMLElement>) => void;
    onDragLeave: (e: DragEvent<HTMLElement>) => void;
    onDrop: (e: DragEvent<HTMLElement>) => void;
  };
}

/** Merging by dropping PDFs onto the rail. Page drags are dnd-kit's and never reach these. */
export function useRailDrop(order: PageId[]): RailDrop {
  // dragenter/dragleave fire for every card, so a depth counter keeps the hint from flickering.
  const depth = useRef(0);
  const [dropping, setDropping] = useState(false);

  const stop = () => {
    depth.current = 0;
    setDropping(false);
  };

  return {
    dropping,
    dropHandlers: {
      onDragEnter: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDropping(true);
      },
      onDragOver: (e) => {
        if (hasFiles(e)) e.preventDefault();
      },
      onDragLeave: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) stop();
      },
      onDrop: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        stop();
        void addFiles(Array.from(e.dataTransfer.files), indexUnder(e, order));
      },
    },
  };
}
