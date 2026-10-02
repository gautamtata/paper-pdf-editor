import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { RGB } from "@/lib/annotations/types";
import type { PageId } from "@/lib/pdf/types";

export enum Tool {
  Select = "select",
  Text = "text",
  Pen = "pen",
  Highlight = "highlight",
  Rect = "rect",
  Signature = "signature",
}

export type SelectMode = "replace" | "toggle" | "range";
export type ZoomMode = "fit-width" | "fit-page" | "custom";

export interface AnnotationRef {
  pageId: PageId;
  id: string;
}

export type ToolSettingKey = "penColor" | "penSize" | "textColor" | "fontSize" | "highlightColor";

export interface EditorState {
  tool: Tool;
  setTool(t: Tool): void;

  selectedPageIds: Set<PageId>;
  /** The page a `range` selection grows from: the last page `replace`d or toggled. */
  anchorId: PageId | null;
  selectPage(id: PageId, mode: SelectMode, order: PageId[]): void;
  selectAll(order: PageId[]): void;
  clearSelection(): void;

  /** The page most visible in the viewer. */
  activePageId: PageId | null;
  setActivePage(id: PageId | null): void;

  selectedAnnotation: AnnotationRef | null;
  setSelectedAnnotation(v: AnnotationRef | null): void;

  zoom: number;
  setZoom(z: number): void;
  zoomMode: ZoomMode;
  setZoomMode(m: ZoomMode): void;

  penColor: RGB;
  penSize: number;
  textColor: RGB;
  fontSize: number;
  highlightColor: RGB;
  setToolSetting<K extends ToolSettingKey>(k: K, v: EditorState[K]): void;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

const clampZoom = (z: number): number => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);

const rangeBetween = (order: PageId[], from: number, to: number): Set<PageId> => {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return new Set(order.slice(lo, hi + 1));
};

export const editorStore = createStore<EditorState>()((set, get) => ({
  tool: Tool.Select,
  setTool: (tool) => set({ tool }),

  selectedPageIds: new Set<PageId>(),
  anchorId: null,
  selectPage: (id, mode, order) => {
    if (mode === "toggle") {
      const selectedPageIds = new Set(get().selectedPageIds);
      if (selectedPageIds.has(id)) selectedPageIds.delete(id);
      else selectedPageIds.add(id);
      set({ selectedPageIds, anchorId: id });
      return;
    }
    const { anchorId } = get();
    if (mode === "range" && anchorId !== null) {
      const from = order.indexOf(anchorId);
      const to = order.indexOf(id);
      if (from !== -1 && to !== -1) {
        set({ selectedPageIds: rangeBetween(order, from, to) });
        return;
      }
    }
    set({ selectedPageIds: new Set([id]), anchorId: id });
  },
  selectAll: (order) => set({ selectedPageIds: new Set(order) }),
  clearSelection: () => set({ selectedPageIds: new Set<PageId>(), anchorId: null }),

  activePageId: null,
  setActivePage: (activePageId) => set({ activePageId }),

  selectedAnnotation: null,
  setSelectedAnnotation: (selectedAnnotation) => set({ selectedAnnotation }),

  zoom: 1,
  setZoom: (z) => set({ zoom: clampZoom(z), zoomMode: "custom" }),
  zoomMode: "fit-width",
  setZoomMode: (zoomMode) => set({ zoomMode }),

  penColor: { r: 0, g: 0, b: 0 },
  penSize: 3,
  textColor: { r: 0, g: 0, b: 0 },
  fontSize: 14,
  highlightColor: { r: 1, g: 0.9, b: 0.2 },
  setToolSetting: <K extends ToolSettingKey>(k: K, v: EditorState[K]): void => {
    const patch: Partial<Pick<EditorState, ToolSettingKey>> = {};
    patch[k] = v;
    set(patch);
  },
}));

export const useEditor = <T>(selector: (s: EditorState) => T): T =>
  useStore(editorStore, selector);
