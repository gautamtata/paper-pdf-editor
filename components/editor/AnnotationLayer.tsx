"use client";

import { useCallback, useEffect, useMemo, useState, type PointerEvent } from "react";
import { ImageShape } from "@/components/editor/annotations/ImageShape";
import { InkShape } from "@/components/editor/annotations/InkShape";
import { PropertiesPopover } from "@/components/editor/annotations/PropertiesPopover";
import { RectShape } from "@/components/editor/annotations/RectShape";
import { screenBox, SelectionHandles } from "@/components/editor/annotations/SelectionHandles";
import { TextShape } from "@/components/editor/annotations/TextShape";
import { useDrawTool } from "@/components/editor/annotations/useDrawTool";
import { useSelectTool } from "@/components/editor/annotations/useSelectTool";
import {
  applyMatrix,
  clampRect,
  invertMatrix,
  matrixToCss,
  type Matrix,
} from "@/lib/annotations/geometry";
import {
  AnnotationKind,
  annotationBounds,
  type Annotation,
  type TextAnnotation,
} from "@/lib/annotations/types";
import type { VirtualPage } from "@/lib/pdf/types";
import { Tool, editorStore, useEditor } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";

const CURSORS: Partial<Record<Tool, string>> = {
  [Tool.Pen]: "cursor-crosshair",
  [Tool.Highlight]: "cursor-crosshair",
  [Tool.Rect]: "cursor-crosshair",
  [Tool.Text]: "cursor-text",
};

const DRAW_TOOLS = new Set<Tool>([Tool.Pen, Tool.Highlight, Tool.Rect, Tool.Text]);

interface AnnotationLayerProps {
  page: VirtualPage;
  /** PDF user space of the unrotated page to CSS pixels of the page box. */
  transform: Matrix;
  width: number;
  height: number;
  /** Provided by the signature library (task 12); the properties popover offers it for images. */
  onSaveSignature?(png: Uint8Array): void;
}

/**
 * The interactive overlay on one page. Shapes live in PDF user space inside a single transformed
 * group, so nothing has to be re-measured when the zoom changes.
 */
export function AnnotationLayer({
  page,
  transform,
  width,
  height,
  onSaveSignature,
}: AnnotationLayerProps) {
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selectedAnnotation);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);

  const inverse = useMemo(() => invertMatrix(transform), [transform]);
  const toPdf = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const box = svg?.getBoundingClientRect();
      const [x, y] = applyMatrix(
        inverse,
        e.clientX - (box?.left ?? 0),
        e.clientY - (box?.top ?? 0),
      );
      return { x, y };
    },
    [inverse, svg],
  );

  const draw = useDrawTool({
    pageId: page.id,
    pageSize: page.size,
    toPdf,
    onEditText: setEditingId,
  });
  const select = useSelectTool({ pageId: page.id, pageSize: page.size, toPdf });

  const drawing = DRAW_TOOLS.has(tool);
  const interactive = tool === Tool.Select;
  const gesturing = draw.draft !== null || select.dragging;
  const { cancel: cancelDraw } = draw;
  const { cancel: cancelSelect } = select;

  // Escape belongs to the gesture in flight; it must not also reach the global tool shortcuts.
  useEffect(() => {
    if (!gesturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      cancelDraw();
      cancelSelect();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [gesturing, cancelDraw, cancelSelect]);

  /** A text box keeps its top edge and grows downwards, so a taller box has a lower `y`. */
  const commitText = (a: TextAnnotation, content: string, contentHeight: number): void => {
    setEditingId(null);
    editorStore.getState().setTool(Tool.Select);
    const ws = workspaceStore.getState();
    if (content.trim() === "") {
      ws.removeAnnotation(page.id, a.id);
      editorStore.getState().setSelectedAnnotation(null);
      return;
    }
    const h = Math.max(contentHeight, a.rect.h);
    const rect = clampRect({ x: a.rect.x, y: a.rect.y + a.rect.h - h, w: a.rect.w, h }, page.size);
    ws.updateAnnotation(page.id, a.id, { content, rect });
  };

  const shapeOf = (a: Annotation) => {
    const onPointerDown = (e: PointerEvent<SVGElement>) => select.shapeDown(a, e);
    switch (a.kind) {
      case AnnotationKind.Text:
        return (
          <TextShape
            key={a.id}
            a={a}
            editing={editingId === a.id}
            interactive={interactive}
            onPointerDown={onPointerDown}
            onEdit={() => setEditingId(a.id)}
            onCommit={(content, contentHeight) => commitText(a, content, contentHeight)}
            onCancel={() => setEditingId(null)}
          />
        );
      case AnnotationKind.Ink:
        return <InkShape key={a.id} a={a} interactive={interactive} onPointerDown={onPointerDown} />;
      case AnnotationKind.Image:
        return (
          <ImageShape key={a.id} a={a} interactive={interactive} onPointerDown={onPointerDown} />
        );
      default:
        return <RectShape key={a.id} a={a} interactive={interactive} onPointerDown={onPointerDown} />;
    }
  };

  const selected =
    selection?.pageId === page.id && editingId === null
      ? page.annotations.find((a) => a.id === selection.id)
      : undefined;
  const bounds = selected === undefined ? null : annotationBounds(selected);
  const box = bounds === null ? null : screenBox(bounds, transform);

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        ref={setSvg}
        data-testid="annotation-layer"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("absolute inset-0", CURSORS[tool])}
        style={{
          pointerEvents: tool === Tool.Signature ? "none" : "auto",
          touchAction: drawing ? "none" : undefined,
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (editingId !== null) return;
          if (drawing) draw.down(e);
          else if (interactive) select.backgroundDown();
        }}
        onPointerMove={(e) => {
          draw.move(e);
          select.move(e);
        }}
        onPointerUp={(e) => {
          draw.up(e);
          select.up();
        }}
        onPointerCancel={() => {
          draw.cancel();
          select.cancel();
        }}
      >
        <g transform={matrixToCss(transform)}>
          {page.annotations.map(shapeOf)}
          {draw.draft === null ? null : draw.draft.kind === "pen" ? (
            <path
              ref={(el) => draw.attachDraft(el)}
              d=""
              fill={draw.draft.fill}
              style={{ pointerEvents: "none" }}
            />
          ) : (
            <rect
              ref={(el) => draw.attachDraft(el)}
              x={0}
              y={0}
              width={0}
              height={0}
              fill={draw.draft.fill}
              fillOpacity={draw.draft.opacity}
              stroke={draw.draft.stroke}
              strokeWidth={draw.draft.strokeWidth}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
        {bounds === null || !interactive ? null : (
          <SelectionHandles
            bounds={bounds}
            transform={transform}
            onHandleDown={(h, e) => selected !== undefined && select.handleDown(selected, h, e)}
          />
        )}
      </svg>
      {selected === undefined || box === null || !interactive || gesturing ? null : (
        <PropertiesPopover
          pageId={page.id}
          annotation={selected}
          anchor={{ x: box.x + box.w / 2, y: box.y }}
          onSaveSignature={onSaveSignature}
        />
      )}
    </div>
  );
}
