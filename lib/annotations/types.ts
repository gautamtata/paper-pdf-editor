import { strokeBounds } from "@/lib/annotations/ink";
import { newId } from "@/lib/pdf/types";

export enum AnnotationKind {
  Text = "text",
  Ink = "ink",
  Highlight = "highlight",
  Rect = "rect",
  Image = "image",
}

/** PDF user space points, y-up; `(x, y)` is the bottom-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Channels in 0..1, as pdf-lib wants them. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** A sampled ink point; `p` is pressure in 0..1. */
export interface InkPoint {
  x: number;
  y: number;
  p: number;
}

interface Base {
  id: string;
  kind: AnnotationKind;
}

export interface TextAnnotation extends Base {
  kind: AnnotationKind.Text;
  rect: Rect;
  fontSize: number;
  color: RGB;
  content: string;
}

export interface InkAnnotation extends Base {
  kind: AnnotationKind.Ink;
  strokes: InkPoint[][];
  color: RGB;
  size: number;
}

export interface HighlightAnnotation extends Base {
  kind: AnnotationKind.Highlight;
  rect: Rect;
  color: RGB;
  opacity: number;
}

export interface RectAnnotation extends Base {
  kind: AnnotationKind.Rect;
  rect: Rect;
  strokeColor: RGB;
  strokeWidth: number;
  fill: RGB | null;
}

export interface ImageAnnotation extends Base {
  kind: AnnotationKind.Image;
  rect: Rect;
  png: Uint8Array;
  /** Intrinsic width / height, preserved on resize. */
  aspect: number;
}

export type Annotation =
  | TextAnnotation
  | InkAnnotation
  | HighlightAnnotation
  | RectAnnotation
  | ImageAnnotation;

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const HIGHLIGHT_YELLOW: RGB = { r: 1, g: 0.9, b: 0.2 };

const copyRect = (r: Rect): Rect => ({ x: r.x, y: r.y, w: r.w, h: r.h });
const copyRgb = (c: RGB): RGB => ({ r: c.r, g: c.g, b: c.b });
const copyStrokes = (strokes: InkPoint[][]): InkPoint[][] =>
  strokes.map((stroke) => stroke.map((p) => ({ x: p.x, y: p.y, p: p.p })));

export const createText = (
  rect: Rect,
  opts?: Partial<Omit<TextAnnotation, "id" | "kind" | "rect">>,
): TextAnnotation => ({
  id: newId(),
  kind: AnnotationKind.Text,
  rect: copyRect(rect),
  fontSize: opts?.fontSize ?? 14,
  color: copyRgb(opts?.color ?? BLACK),
  content: opts?.content ?? "",
});

export const createInk = (strokes: InkPoint[][], color: RGB, size: number): InkAnnotation => ({
  id: newId(),
  kind: AnnotationKind.Ink,
  strokes: copyStrokes(strokes),
  color: copyRgb(color),
  size,
});

export const createHighlight = (rect: Rect, color: RGB = HIGHLIGHT_YELLOW): HighlightAnnotation => ({
  id: newId(),
  kind: AnnotationKind.Highlight,
  rect: copyRect(rect),
  color: copyRgb(color),
  opacity: 0.35,
});

export const createRect = (
  rect: Rect,
  opts?: Partial<Omit<RectAnnotation, "id" | "kind" | "rect">>,
): RectAnnotation => ({
  id: newId(),
  kind: AnnotationKind.Rect,
  rect: copyRect(rect),
  strokeColor: copyRgb(opts?.strokeColor ?? BLACK),
  strokeWidth: opts?.strokeWidth ?? 2,
  fill: opts?.fill === undefined || opts.fill === null ? null : copyRgb(opts.fill),
});

/** `png` is kept by reference: image bytes are treated as immutable. */
export const createImage = (rect: Rect, png: Uint8Array, aspect: number): ImageAnnotation => ({
  id: newId(),
  kind: AnnotationKind.Image,
  rect: copyRect(rect),
  png,
  aspect,
});

const ZERO_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

const union = (boxes: Rect[]): Rect => {
  if (boxes.length === 0) return { ...ZERO_RECT };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** The bbox of the ink points themselves, unpadded; `null` when the annotation has no points. */
const rawInkBounds = (a: InkAnnotation): Rect | null => {
  const boxes = a.strokes
    .filter((stroke) => stroke.length > 0)
    .map((stroke) => strokeBounds(stroke, 0));
  return boxes.length === 0 ? null : union(boxes);
};

/** Ink: the point bbox padded by `size / 2`. Every other kind: a copy of its rect. */
export function annotationBounds(a: Annotation): Rect {
  if (a.kind !== AnnotationKind.Ink) return copyRect(a.rect);
  const raw = rawInkBounds(a);
  if (raw === null) return { ...ZERO_RECT };
  const pad = a.size / 2;
  return { x: raw.x - pad, y: raw.y - pad, w: raw.w + a.size, h: raw.h + a.size };
}

const moved = (a: Annotation, dx: number, dy: number): Annotation =>
  a.kind === AnnotationKind.Ink
    ? {
        ...a,
        strokes: a.strokes.map((stroke) =>
          stroke.map((p) => ({ x: p.x + dx, y: p.y + dy, p: p.p })),
        ),
      }
    : { ...a, rect: { ...a.rect, x: a.rect.x + dx, y: a.rect.y + dy } };

export const translateAnnotation = <A extends Annotation>(a: A, dx: number, dy: number): A =>
  moved(a, dx, dy) as A;

const scaled = (a: Annotation, rect: Rect): Annotation => {
  switch (a.kind) {
    case AnnotationKind.Ink: {
      const raw = rawInkBounds(a);
      if (raw === null) return { ...a, strokes: copyStrokes(a.strokes) };
      // The points span the rect inset by the stroke padding, so that the padded bounds of the
      // result are `rect` itself. A rect thinner than the stroke collapses rather than inverting.
      const pad = a.size / 2;
      const sx = raw.w === 0 ? 1 : Math.max(rect.w - a.size, 0) / raw.w;
      const sy = raw.h === 0 ? 1 : Math.max(rect.h - a.size, 0) / raw.h;
      return {
        ...a,
        strokes: a.strokes.map((stroke) =>
          stroke.map((p) => ({
            x: rect.x + pad + (p.x - raw.x) * sx,
            y: rect.y + pad + (p.y - raw.y) * sy,
            p: p.p,
          })),
        ),
      };
    }
    case AnnotationKind.Image:
      return { ...a, rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.w / a.aspect } };
    default:
      return { ...a, rect: copyRect(rect) };
  }
};

/**
 * `annotationBounds` of the result is `rect`, and resizing to the same rect again is a no-op.
 * Ink points scale onto `rect`; images keep `aspect` by deriving `h` from `w`.
 */
export const resizeAnnotation = <A extends Annotation>(a: A, rect: Rect): A =>
  scaled(a, rect) as A;

const toChannel = (v: number): number => Math.round(Math.min(Math.max(v, 0), 1) * 255);

export const rgbToCss = (c: RGB): string =>
  `rgb(${toChannel(c.r)} ${toChannel(c.g)} ${toChannel(c.b)})`;

export const hexToRgb = (hex: string): RGB => {
  const raw = hex.startsWith("#") ? hex.slice(1) : hex;
  const full = raw.length === 3 ? raw.replace(/./g, (d) => d + d) : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`hexToRgb: invalid hex color "${hex}"`);
  const n = Number.parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};
