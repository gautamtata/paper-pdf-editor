import {
  BlendMode,
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { strokeToPath } from "@/lib/annotations/ink";
import { displayBox } from "@/lib/pdf/box";
import {
  AnnotationKind,
  type Annotation,
  type HighlightAnnotation,
  type ImageAnnotation,
  type InkAnnotation,
  type Rect,
  type RectAnnotation,
  type RGB,
  type TextAnnotation,
} from "@/lib/annotations/types";

export interface FlattenContext {
  doc: PDFDocument;
  font: PDFFont;
  /** Embedded PNGs keyed by annotation id, so a png is embedded once per export. */
  imageCache: Map<string, PDFImage>;
}

/** The page's display box; `x`/`y` offset every drawing so (0,0) means the box's corner. */
interface Box {
  x: number;
  y: number;
  height: number;
}

const toColor = (c: RGB) => rgb(c.r, c.g, c.b);

const placed = (r: Rect, box: Box) => ({ x: box.x + r.x, y: box.y + r.y, width: r.w, height: r.h });

/** Helvetica is WinAnsi-only; anything it cannot encode (e.g. emoji) becomes `?`. */
function encodable(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return [...text]
    .map((ch) => (/[\r\n]/.test(ch) || supported.has(ch.codePointAt(0) ?? -1) ? ch : "?"))
    .join("");
}

function drawText(page: PDFPage, a: TextAnnotation, ctx: FlattenContext, box: Box): void {
  const { x, y } = placed(a.rect, box);
  page.drawText(encodable(a.content, ctx.font), {
    x,
    y: y + a.rect.h - a.fontSize,
    size: a.fontSize,
    font: ctx.font,
    color: toColor(a.color),
    maxWidth: a.rect.w,
    lineHeight: a.fontSize * 1.25,
  });
}

function drawHighlight(page: PDFPage, a: HighlightAnnotation, box: Box): void {
  page.drawRectangle({
    ...placed(a.rect, box),
    color: toColor(a.color),
    opacity: a.opacity,
    blendMode: BlendMode.Multiply,
  });
}

function drawRect(page: PDFPage, a: RectAnnotation, box: Box): void {
  page.drawRectangle({
    ...placed(a.rect, box),
    borderColor: toColor(a.strokeColor),
    borderWidth: a.strokeWidth,
    color: a.fill === null ? undefined : toColor(a.fill),
  });
}

async function drawImage(
  page: PDFPage,
  a: ImageAnnotation,
  ctx: FlattenContext,
  box: Box,
): Promise<void> {
  let image = ctx.imageCache.get(a.id);
  if (image === undefined) {
    image = await ctx.doc.embedPng(a.png);
    ctx.imageCache.set(a.id, image);
  }
  page.drawImage(image, placed(a.rect, box));
}

/** Strokes are y-up; pdf-lib's SVG paths are y-down from the given origin, so flip about the top edge. */
function drawInk(page: PDFPage, a: InkAnnotation, box: Box): void {
  const color = toColor(a.color);
  for (const stroke of a.strokes) {
    const path = strokeToPath(
      stroke.map((p) => ({ x: p.x, y: box.height - p.y, p: p.p })),
      a.size,
    );
    if (path === "") continue;
    page.drawSvgPath(path, { x: box.x, y: box.y + box.height, color, borderWidth: 0 });
  }
}

/** Draws `annotations` into the page's content stream; annotation space is the unrotated display box. */
export async function flattenAnnotations(
  page: PDFPage,
  annotations: Annotation[],
  ctx: FlattenContext,
): Promise<void> {
  const box = displayBox(page);
  for (const a of annotations) {
    switch (a.kind) {
      case AnnotationKind.Text:
        drawText(page, a, ctx, box);
        break;
      case AnnotationKind.Highlight:
        drawHighlight(page, a, box);
        break;
      case AnnotationKind.Rect:
        drawRect(page, a, box);
        break;
      case AnnotationKind.Image:
        await drawImage(page, a, ctx, box);
        break;
      case AnnotationKind.Ink:
        drawInk(page, a, box);
        break;
    }
  }
}
