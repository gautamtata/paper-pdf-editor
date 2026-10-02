"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clampRect, normalizeRect } from "@/lib/annotations/geometry";
import { strokeToPath } from "@/lib/annotations/ink";
import {
  AnnotationKind,
  createHighlight,
  createInk,
  createRect,
  createText,
  rgbToCss,
  type InkPoint,
  type RGB,
} from "@/lib/annotations/types";
import type { PageId, PageSize } from "@/lib/pdf/types";
import { Tool, editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";

export interface Draft {
  kind: "pen" | "box";
  fill: string;
  opacity: number;
  stroke: string;
  strokeWidth: number;
}

interface Point {
  x: number;
  y: number;
}

/** Strokes drawn this close together in time join one annotation, so a crossed "t" is one object. */
const MERGE_MS = 600;
/** A drag shorter than this many CSS pixels is a click, not a box. */
const MIN_DRAG_PX = 3;
/** The box a text click opens: a 200pt line hanging below the click, per the editor's text metrics. */
const TEXT_BOX = { w: 200, h: 20 };

interface Options {
  pageId: PageId;
  pageSize: PageSize;
  toPdf(e: { clientX: number; clientY: number }): Point;
  /** Opens the inline editor on a text box the moment it is created. */
  onEditText(id: string): void;
}

export interface DrawTool {
  draft: Draft | null;
  attachDraft(el: SVGElement | null): void;
  down(e: ReactPointerEvent<SVGElement>): void;
  move(e: ReactPointerEvent<SVGElement>): void;
  up(e: ReactPointerEvent<SVGElement>): void;
  cancel(): void;
}

interface Gesture {
  tool: Tool;
  origin: Point;
  originClient: Point;
  last: Point;
  points: InkPoint[];
  color: RGB;
  size: number;
}

/**
 * Pointer handling for the drawing tools. Live feedback is written straight onto the draft
 * element inside a `requestAnimationFrame`, so a stroke costs two renders, not one per event.
 */
export function useDrawTool({ pageId, pageSize, toPdf, onEditText }: Options): DrawTool {
  const [draft, setDraft] = useState<Draft | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const element = useRef<SVGElement | null>(null);
  const frame = useRef<number | null>(null);
  const lastInk = useRef<{ id: string; endedAt: number } | null>(null);

  const paint = useCallback(() => {
    frame.current = null;
    const g = gesture.current;
    const el = element.current;
    if (g === null || el === null) return;
    if (g.tool === Tool.Pen) {
      el.setAttribute("d", strokeToPath(g.points, g.size));
      return;
    }
    const r = normalizeRect(g.origin.x, g.origin.y, g.last.x, g.last.y);
    el.setAttribute("x", String(r.x));
    el.setAttribute("y", String(r.y));
    el.setAttribute("width", String(r.w));
    el.setAttribute("height", String(r.h));
  }, []);

  const reset = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    gesture.current = null;
    element.current = null;
    setDraft(null);
  }, []);

  const addText = useCallback(
    (at: Point) => {
      const editor = editorStore.getState();
      const box = clampRect({ x: at.x, y: at.y - TEXT_BOX.h, ...TEXT_BOX }, pageSize);
      const text = createText(box, { fontSize: editor.fontSize, color: editor.textColor });
      // Transient until the first commit: an abandoned box costs no history entry at all.
      workspaceStore.getState().addAnnotation(pageId, text, { transient: true });
      editor.setSelectedAnnotation({ pageId, id: text.id });
      onEditText(text.id);
    },
    [onEditText, pageId, pageSize],
  );

  const down = useCallback(
    (e: ReactPointerEvent<SVGElement>) => {
      const editor = editorStore.getState();
      const at = toPdf(e);
      if (editor.tool === Tool.Text) {
        addText(at);
        return;
      }
      const { tool, penColor, penSize, highlightColor } = editor;
      if (tool !== Tool.Pen && tool !== Tool.Highlight && tool !== Tool.Rect) return;

      gesture.current = {
        tool,
        origin: at,
        originClient: { x: e.clientX, y: e.clientY },
        last: at,
        points: [{ x: at.x, y: at.y, p: e.pressure || 0.5 }],
        color: tool === Tool.Highlight ? highlightColor : penColor,
        size: penSize,
      };
      if (tool === Tool.Pen) {
        setDraft({ kind: "pen", fill: rgbToCss(penColor), opacity: 1, stroke: "none", strokeWidth: 0 });
      } else if (tool === Tool.Highlight) {
        setDraft({
          kind: "box",
          fill: rgbToCss(highlightColor),
          opacity: 0.35,
          stroke: "none",
          strokeWidth: 0,
        });
      } else {
        setDraft({
          kind: "box",
          fill: "none",
          opacity: 1,
          stroke: rgbToCss(penColor),
          strokeWidth: 2,
        });
      }
    },
    [addText, toPdf],
  );

  const move = useCallback(
    (e: ReactPointerEvent<SVGElement>) => {
      const g = gesture.current;
      if (g === null) return;
      const at = toPdf(e);
      g.last = at;
      if (g.tool === Tool.Pen) g.points.push({ x: at.x, y: at.y, p: e.pressure || 0.5 });
      if (frame.current === null) frame.current = requestAnimationFrame(paint);
    },
    [paint, toPdf],
  );

  const commitInk = useCallback(
    (g: Gesture) => {
      const stroke = g.points.length === 1 ? [g.points[0], { ...g.points[0] }] : g.points;
      const ws = workspaceStore.getState();
      const previous = lastInk.current;
      const recent =
        previous !== null && Date.now() - previous.endedAt < MERGE_MS
          ? ws.workspace?.pages
              .find((page) => page.id === pageId)
              ?.annotations.find((a) => a.id === previous.id)
          : undefined;
      if (previous !== null && recent !== undefined && recent.kind === AnnotationKind.Ink) {
        ws.updateAnnotation(pageId, previous.id, { strokes: [...recent.strokes, stroke] });
        lastInk.current = { id: previous.id, endedAt: Date.now() };
        return;
      }
      const ink = createInk([stroke], g.color, g.size);
      ws.addAnnotation(pageId, ink);
      lastInk.current = { id: ink.id, endedAt: Date.now() };
    },
    [pageId],
  );

  const commitBox = useCallback(
    (g: Gesture, e: ReactPointerEvent<SVGElement>) => {
      if (
        Math.abs(e.clientX - g.originClient.x) < MIN_DRAG_PX &&
        Math.abs(e.clientY - g.originClient.y) < MIN_DRAG_PX
      ) {
        return;
      }
      const box = clampRect(normalizeRect(g.origin.x, g.origin.y, g.last.x, g.last.y), pageSize);
      const a =
        g.tool === Tool.Highlight
          ? createHighlight(box, g.color)
          : createRect(box, { strokeColor: g.color });
      workspaceStore.getState().addAnnotation(pageId, a);
      editorStore.getState().setSelectedAnnotation({ pageId, id: a.id });
    },
    [pageId, pageSize],
  );

  const up = useCallback(
    (e: ReactPointerEvent<SVGElement>) => {
      const g = gesture.current;
      if (g === null) return;
      if (g.tool === Tool.Pen) commitInk(g);
      else commitBox(g, e);
      reset();
    },
    [commitBox, commitInk, reset],
  );

  const cancel = useCallback(() => {
    if (gesture.current === null) return;
    workspaceStore.getState().cancelGesture();
    reset();
  }, [reset]);

  const attachDraft = useCallback(
    (el: SVGElement | null) => {
      element.current = el;
      if (el !== null) paint();
    },
    [paint],
  );

  return { draft, attachDraft, down, move, up, cancel };
}
