"use client";

import { useCallback, useEffect } from "react";
import { clampRect } from "@/lib/annotations/geometry";
import type { TextAnnotation } from "@/lib/annotations/types";
import type { VirtualPage } from "@/lib/pdf/types";
import { Tool, editorStore, useEditor } from "@/lib/store/editor";
import { selectPage, useWorkspace, workspaceStore } from "@/lib/store/workspace";

export interface TextEditing {
  /** The box this page has open, if it is the one open anywhere. */
  editingId: string | null;
  /** Whether any page has a box open: a press anywhere else has to finish it first. */
  editingOpen: boolean;
  open(id: string): void;
  /** Blur: saves what was typed, or disposes of a box left empty. */
  commit(a: TextAnnotation, content: string, contentHeight: number): void;
  /** Escape: the edits go, and a box that never committed goes with its own creation. */
  cancel(a: TextAnnotation): void;
}

/**
 * Which text box is open is editor-wide state, because only one can be, and the layer that opens
 * one is not always the layer that has to close it.
 */
export function useTextEditing(page: VirtualPage): TextEditing {
  const editor = useEditor((s) => s.editingAnnotation);
  const editingId = editor?.pageId === page.id ? editor.id : null;
  // Read from the store, not the `page` prop: a prop one render behind must not read as "gone".
  const live = useWorkspace(selectPage(page.id));

  const open = useCallback(
    (id: string) => editorStore.getState().setEditingAnnotation({ pageId: page.id, id }),
    [page.id],
  );
  const close = useCallback(() => editorStore.getState().setEditingAnnotation(null), []);

  // A box can go while this layer still points at it — undo, or another page cancelling the
  // gesture that created it. Without this the layer would swallow every later press.
  useEffect(() => {
    if (editingId === null) return;
    if (live?.annotations.some((a) => a.id === editingId) === true) return;
    close();
  }, [editingId, live, close]);

  /** A box that never committed is still transient, so cancelling undoes its creation too. */
  const dispose = (a: TextAnnotation): void => {
    const ws = workspaceStore.getState();
    if (a.content === "") ws.cancelGesture({ pageId: page.id, id: a.id });
    else ws.removeAnnotation(page.id, a.id);
    editorStore.getState().setSelectedAnnotation(null);
  };

  /** A text box keeps its top edge and grows downwards, so a taller box has a lower `y`. */
  const commit = (a: TextAnnotation, content: string, contentHeight: number): void => {
    close();
    editorStore.getState().setTool(Tool.Select);
    if (content.trim() === "") {
      dispose(a);
      return;
    }
    const h = Math.max(contentHeight, a.rect.h);
    const rect = clampRect({ x: a.rect.x, y: a.rect.y + a.rect.h - h, w: a.rect.w, h }, page.size);
    workspaceStore.getState().updateAnnotation(page.id, a.id, { content, rect });
  };

  const cancel = (a: TextAnnotation): void => {
    close();
    if (a.content === "") dispose(a);
  };

  return { editingId, editingOpen: editor !== null, open, commit, cancel };
}
