"use client";

import { useEffect, useRef } from "react";
import type { SourceId } from "@/lib/pdf/types";
import { removeSource } from "@/lib/render/renderer";

/**
 * Frees a workspace's pdf.js documents and rendered bitmaps once it is no longer the open one:
 * on a switch to another workspace, and on unmount.
 */
export function useReleaseSources(workspaceId: string, sourceIds: SourceId[]): void {
  const latest = useRef(sourceIds);
  useEffect(() => {
    latest.current = sourceIds;
  }, [sourceIds]);
  useEffect(
    () => () => {
      for (const id of latest.current) removeSource(id);
    },
    [workspaceId],
  );
}
