"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { registerOpenEditor } from "@/components/editor/annotations/openEditor";
import { rgbToCss, type TextAnnotation } from "@/lib/annotations/types";

interface TextShapeProps {
  a: TextAnnotation;
  editing: boolean;
  interactive: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
  /** `height` is the content height in PDF points; `content` is already plain text. */
  onCommit(content: string, height: number): void;
  onCancel(): void;
}

/** The line height the export flattens text with, so wrapping on screen matches the PDF. */
const LINE_HEIGHT = 1.25;

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
  onCommit,
  onCancel,
}: TextShapeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const latestCommit = useRef(onCommit);
  const [grown, setGrown] = useState(a.rect.h);

  useEffect(() => {
    latestCommit.current = onCommit;
  });

  useEffect(() => {
    const el = ref.current;
    if (!editing || el === null) return;
    finished.current = false;
    el.textContent = a.content;
    el.focus();
    caretToEnd(el);
    setGrown(Math.max(el.scrollHeight, a.rect.h));
    // Another page's layer finishes this box through here before it opens one of its own.
    return registerOpenEditor(a.id, () => {
      finished.current = true;
      latestCommit.current(el.textContent ?? "", el.scrollHeight);
    });
  }, [editing, a.id, a.content, a.rect.h]);

  const height = editing ? Math.max(grown, a.rect.h) : a.rect.h;

  return (
    <g
      data-annotation-id={a.id}
      transform={`translate(${a.rect.x}, ${a.rect.y + a.rect.h}) scale(1,-1)`}
    >
      <foreignObject x={0} y={0} width={a.rect.w} height={height} style={{ overflow: "visible" }}>
        <div
          ref={ref}
          data-slot="text-editor"
          contentEditable={editing ? "plaintext-only" : false}
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
            userSelect: editing ? "text" : "none",
            background: editing
              ? "color-mix(in oklab, var(--color-accent) 8%, transparent)"
              : undefined,
            pointerEvents: editing ? "auto" : "none",
          }}
          onInput={(e) => setGrown(e.currentTarget.scrollHeight)}
          onBlur={(e) => {
            if (finished.current) return;
            onCommit(e.currentTarget.textContent ?? "", e.currentTarget.scrollHeight);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              finished.current = true;
              e.currentTarget.blur();
              onCancel();
              return;
            }
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
        />
      )}
    </g>
  );
}
