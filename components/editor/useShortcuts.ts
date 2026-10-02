"use client";

import { useEffect, useRef } from "react";
import {
  deleteSelected,
  duplicateSelected,
  pageOrder,
  rotateSelected,
  zoomIn,
  zoomOut,
} from "@/components/editor/actions";
import { Rotation } from "@/lib/pdf/types";
import { Tool, editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";

export interface ShortcutHandlers {
  /** The scale on screen, so a zoom step starts from what the eye sees, not the stored zoom. */
  displayScale?: number;
  onExport?: () => void;
  onOpenPalette?: () => void;
}

const TOOL_KEYS: Record<string, Tool> = {
  v: Tool.Select,
  t: Tool.Text,
  p: Tool.Pen,
  h: Tool.Highlight,
  s: Tool.Signature,
};

/** Somewhere that owns the keyboard: a field, or a dialog or menu that handles its own keys. */
const ownsKeyboard = (el: Element | null): boolean => {
  if (el === null) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.closest("[role=dialog],[role=menu]") !== null;
};

const blocked = (target: EventTarget | null): boolean =>
  ownsKeyboard(target instanceof Element ? target : null) ||
  ownsKeyboard(document.activeElement);

export function useShortcuts(handlers: ShortcutHandlers = {}): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (blocked(e.target)) return;
      const editor = editorStore.getState();
      const ws = workspaceStore.getState();
      const scale = latest.current.displayScale ?? editor.zoom;
      const key = e.key.toLowerCase();

      if (e.metaKey || e.ctrlKey) {
        if (key === "z" && e.shiftKey) run(e, ws.redo);
        else if (key === "z") run(e, ws.undo);
        else if (key === "y") run(e, ws.redo);
        else if (key === "a") run(e, () => editor.selectAll(pageOrder()));
        else if (key === "d") run(e, duplicateSelected);
        else if (key === "e") run(e, () => latest.current.onExport?.());
        else if (key === "k") run(e, () => latest.current.onOpenPalette?.());
        else if (key === "=" || key === "+") run(e, () => zoomIn(scale));
        else if (key === "-") run(e, () => zoomOut(scale));
        else if (key === "0") run(e, () => editor.setZoomMode("fit-width"));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const annotation = editor.selectedAnnotation;
        if (annotation === null) {
          deleteSelected();
          return;
        }
        ws.removeAnnotation(annotation.pageId, annotation.id);
        editor.setSelectedAnnotation(null);
        return;
      }

      if (e.key === "Escape") {
        editor.setTool(Tool.Select);
        editor.setSelectedAnnotation(null);
        editor.clearSelection();
        return;
      }

      // R is the rect tool only when there is nothing to rotate; otherwise it rotates.
      if (key === "r") {
        const nothingSelected =
          editor.selectedPageIds.size === 0 && editor.selectedAnnotation === null;
        if (editor.tool === Tool.Select && nothingSelected) editor.setTool(Tool.Rect);
        else if (editor.selectedAnnotation === null && editor.selectedPageIds.size > 0) {
          rotateSelected(e.shiftKey ? Rotation.R270 : Rotation.R90);
        }
        return;
      }

      const tool = TOOL_KEYS[key];
      if (tool !== undefined) editor.setTool(tool);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

const run = (e: KeyboardEvent, action: () => void): void => {
  e.preventDefault();
  action();
};
