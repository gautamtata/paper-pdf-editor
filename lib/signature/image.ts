import type { Rect } from "@/lib/annotations/types";

/** Luminance above this reads as paper rather than ink. */
const PAPER_LUMA = 0.82;
/** How quickly alpha ramps up below the cutoff; above 1 it keeps mid-greys solid. */
const EDGE_GAIN = 1.6;
/** Breathing room kept around trimmed content, in output pixels. */
const TRIM_PAD = 8;
/** Phone photos arrive at camera resolution; a signature needs nothing like it. */
const MAX_SIDE = 1600;

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/**
 * Turns a photographed page into ink on transparency, in place: paper drops out entirely and the
 * grey rim around a stroke keeps a partial alpha, so edges stay soft instead of jagged.
 */
export function thresholdToTransparent(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const luma = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    data[i + 3] =
      luma > PAPER_LUMA ? 0 : Math.round(255 * clamp01(((PAPER_LUMA - luma) / PAPER_LUMA) * EDGE_GAIN));
  }
}

/** The bbox of every pixel with any alpha left, in pixel coordinates; `null` when none have. */
export function contentBounds(data: Uint8ClampedArray, w: number, h: number): Rect | null {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** A new canvas holding just the drawn content, padded; `null` when the source is blank. */
export function trimCanvas(canvas: HTMLCanvasElement, pad = TRIM_PAD): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d");
  if (ctx === null || canvas.width === 0 || canvas.height === 0) return null;
  const box = contentBounds(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  if (box === null) return null;
  const out = createCanvas(box.w + pad * 2, box.h + pad * 2);
  const outCtx = out.getContext("2d");
  if (outCtx === null) return null;
  outCtx.drawImage(canvas, box.x, box.y, box.w, box.h, pad, pad, box.w, box.h);
  return out;
}

export interface SignatureImage {
  png: Uint8Array;
  /** Intrinsic width / height, which placement keeps. */
  aspect: number;
}

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<SignatureImage> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob === null) throw new Error("This browser couldn't write the signature image");
  return { png: new Uint8Array(await blob.arrayBuffer()), aspect: canvas.width / canvas.height };
}

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be read"));
    img.src = src;
  });

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

async function decodeImage(source: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Falls through to <img>, which decodes a few formats createImageBitmap refuses.
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pngAspect(png: Uint8Array): Promise<number> {
  const { width, height, release } = await decodeImage(
    new Blob([png as BlobPart], { type: "image/png" }),
  );
  release();
  return height === 0 ? 1 : width / height;
}

/** A photo of a signature, with the paper dropped out and the ink trimmed to its own bounds. */
export async function fileToTransparentPng(file: File | Blob): Promise<SignatureImage> {
  const { image, width, height, release } = await decodeImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height, 1));
  const canvas = createCanvas(width * scale, height * scale);
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    release();
    throw new Error("This browser can't process images");
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  release();
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  thresholdToTransparent(frame.data);
  ctx.putImageData(frame, 0, 0);
  const trimmed = trimCanvas(canvas);
  if (trimmed === null) throw new Error("That photo came out blank. Try one with darker writing.");
  return canvasToPng(trimmed);
}
