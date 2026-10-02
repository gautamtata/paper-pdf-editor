"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { rgbToCss, type TextAnnotation } from "@/lib/annotations/types";

interface TextShapeProps {
  a: TextAnnotation;
  editing: boolean;
  interactive: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
  onEdit(): void;
  /** `height` is the content height in PDF points; `content` is already plain text. */
  onCommit(content: string, height: number): void;
  onCancel(): void;
}

/** The line height the export flattens text with, so wrapping on screen matches the PDF. */
const LINE_HEIGHT = 1.25;

/** Keeps the box one text node: `textContent` then round-trips newlines exactly. */
function insertPlainText(text: string): void {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function caretToEnd(el: HTMLElement): void {
  const selection = window.getSelection();
  if (selection === null) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function TextShape({
  a,
  editing,
  interactive,
  onPointerDown,
  onEdit,
  onCommit,
  onCancel,
}: TextShapeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);
  const [grown, setGrown] = useState(a.rect.h);

  useEffect(() => {
    const el = ref.current;
    if (!editing || el === null) return;
    cancelled.current = false;
    el.textContent = a.content;
    el.focus();
    caretToEnd(el);
    setGrown(Math.max(el.scrollHeight, a.rect.h));
  }, [editing, a.content, a.rect.h]);

  const height = editing ? Math.max(grown, a.rect.h) : a.rect.h;

  return (
    <g
      data-annotation-id={a.id}
      transform={`translate(${a.rect.x}, ${a.rect.y + a.rect.h}) scale(1,-1)`}
    >
      <foreignObject x={0} y={0} width={a.rect.w} height={height} style={{ overflow: "visible" }}>
        <div
          ref={ref}
          contentEditable={editing}
          suppressContentEditableWarning
          role={editing ? "textbox" : undefined}
          aria-label={editing ? "Text box" : undefined}
          spellCheck={false}
          style={{
            minHeight: a.rect.h,
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: a.fontSize,
            lineHeight: LINE_HEIGHT,
            color: rgbToCss(a.color),
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            outline: "none",
            background: editing ? "var(--color-accent-soft)" : undefined,
            pointerEvents: editing ? "auto" : "none",
          }}
          onInput={(e) => setGrown(e.currentTarget.scrollHeight)}
          onBlur={(e) => {
            if (cancelled.current) return;
            onCommit(e.currentTarget.textContent ?? "", e.currentTarget.scrollHeight);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancelled.current = true;
              e.currentTarget.blur();
              onCancel();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              insertPlainText("\n");
              setGrown(e.currentTarget.scrollHeight);
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            insertPlainText(e.clipboardData.getData("text/plain"));
            setGrown(e.currentTarget.scrollHeight);
          }}
        >
          {editing ? null : a.content}
        </div>
      </foreignObject>
      {editing ? null : (
        <rect
          x={0}
          y={0}
          width={a.rect.w}
          height={a.rect.h}
          fill="none"
          style={{
            pointerEvents: interactive ? "all" : "none",
            cursor: interactive ? "move" : undefined,
          }}
          onPointerDown={onPointerDown}
          onDoubleClick={onEdit}
        />
      )}
    </g>
  );
}
