"use client";

import { Eraser } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import { strokeToPath } from "@/lib/annotations/ink";
import { rgbToCss, type InkPoint, type RGB } from "@/lib/annotations/types";
import { canvasToPng, createCanvas, trimCanvas, type SignatureImage } from "@/lib/signature/image";
import { dpr } from "@/lib/utils";

/** Nib width in pad pixels. Pressure thins it; perfect-freehand fakes pressure for a mouse. */
const NIB = 6;
/** What a pointer reporting no real pressure is recorded as, so `strokeToPath` simulates it. */
const FLAT_PRESSURE = 0.5;
/** Export above the placed size, so ink stays crisp when the page is zoomed in. */
const EXPORT_SCALE = 2;

export interface SignaturePadHandle {
  exportPng(): Promise<SignatureImage>;
  clear(): void;
  isEmpty(): boolean;
}

interface SignaturePadProps {
  color: RGB;
  onInkChange?(hasInk: boolean): void;
  ref?: Ref<SignaturePadHandle>;
}

const paintStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: InkPoint[][],
  color: RGB,
  scale: number,
): void => {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = rgbToCss(color);
  for (const stroke of strokes) {
    const path = strokeToPath(stroke, NIB);
    if (path !== "") ctx.fill(new Path2D(path));
  }
};

/**
 * A pen-feel drawing surface. Points live in pad pixels; the canvas is backed at device scale.
 * The pad stays paper-toned in both themes: the inks are dark, and it stands in for the page.
 */
export function SignaturePad({ color, onInkChange, ref }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<InkPoint[][]>([]);
  const drawing = useRef<InkPoint[] | null>(null);
  const frame = useRef<number | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    if (canvas === null || ctx === null) return;
    const scale = dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const live = drawing.current;
    paintStrokes(ctx, live === null ? strokes.current : [...strokes.current, live], color, scale);
  }, [color]);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      paint();
    });
  }, [paint]);

  // The backing store follows the element's own box, so the pad stays sharp at any dialog width.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const scale = dpr();
      canvas.width = Math.round(box.width * scale);
      canvas.height = Math.round(box.height * scale);
      paint();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const clear = useCallback(() => {
    strokes.current = [];
    drawing.current = null;
    setHasInk(false);
    onInkChange?.(false);
    schedule();
  }, [onInkChange, schedule]);

  const exportPng = useCallback(async (): Promise<SignatureImage> => {
    const box = canvasRef.current?.getBoundingClientRect();
    const canvas = createCanvas((box?.width ?? 0) * EXPORT_SCALE, (box?.height ?? 0) * EXPORT_SCALE);
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("This browser can't export the drawing");
    paintStrokes(ctx, strokes.current, color, EXPORT_SCALE);
    const trimmed = trimCanvas(canvas);
    if (trimmed === null) throw new Error("Draw a signature first");
    return canvasToPng(trimmed);
  }, [color]);

  useImperativeHandle(
    ref,
    () => ({ exportPng, clear, isEmpty: () => strokes.current.length === 0 }),
    [exportPng, clear],
  );

  const pointAt = (e: ReactPointerEvent<HTMLCanvasElement>): InkPoint => {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      p: e.pointerType === "mouse" || e.pressure === 0 ? FLAT_PRESSURE : e.pressure,
    };
  };

  return (
    <div className="relative h-48 overflow-hidden rounded-lg border border-border-strong bg-paper-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 bottom-12 flex items-end gap-2"
      >
        <span className="-mb-2 text-sm text-paper-500">&#10005;</span>
        <span className="h-px flex-1 bg-paper-400/70" />
      </div>
      {hasInk ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-hand text-2xl text-paper-500"
        >
          Sign above the line
        </span>
      )}
      <canvas
        ref={canvasRef}
        data-testid="signature-pad"
        aria-label="Draw your signature"
        className="relative size-full cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          if (typeof e.currentTarget.setPointerCapture === "function") {
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          drawing.current = [pointAt(e)];
          schedule();
        }}
        onPointerMove={(e) => {
          if (drawing.current === null) return;
          drawing.current.push(pointAt(e));
          schedule();
        }}
        onPointerUp={() => {
          const stroke = drawing.current;
          drawing.current = null;
          if (stroke === null) return;
          strokes.current.push(stroke);
          setHasInk(true);
          onInkChange?.(true);
          schedule();
        }}
        onPointerCancel={() => {
          drawing.current = null;
          schedule();
        }}
      />
      {hasInk ? (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-7 px-2 text-xs"
          onClick={clear}
        >
          <Eraser className="size-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
