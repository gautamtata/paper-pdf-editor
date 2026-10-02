"use client";

import { useMemo } from "react";
import type { PageId, VirtualPage } from "@/lib/pdf/types";

/**
 * The page ids in order, with a stable identity while the order holds: an annotation drag
 * replaces the pages array every frame, and nothing keyed on the order should notice.
 */
export function usePageOrder(pages: VirtualPage[]): PageId[] {
  const key = pages.map((page) => page.id).join("\n");
  return useMemo(() => (key === "" ? [] : key.split("\n")), [key]);
}
