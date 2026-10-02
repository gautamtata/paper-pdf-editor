import type { Matrix } from "@/lib/annotations/geometry";
import { addRotation, Rotation, type PageSize, type SourceDoc } from "@/lib/pdf/types";
import { getSourceDocument } from "@/lib/render/pdfjs";

export interface RenderRequest {
  source: SourceDoc;
  pageIndex: number;
  /** Total rotation: intrinsic `/Rotate` plus the virtual page's rotation. */
  rotation: Rotation;
  /** Includes devicePixelRatio; the renderer is DPR-agnostic. */
  scale: number;
}

export interface Rendered {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** pdf.js `viewport.transform`: unrotated PDF user space -> canvas pixels. */
  transform: Matrix;
}

type Draw = (req: RenderRequest, signal: AbortSignal) => Promise<Rendered>;

interface Flight {
  promise: Promise<Rendered>;
  controller: AbortController;
  waiters: number;
}

const MAX_ENTRIES = 80;
const cache = new Map<string, Rendered>();
const inflight = new Map<string, Flight>();
let draw: Draw = drawWithPdfjs;

const cacheKey = ({ source, pageIndex, rotation, scale }: RenderRequest): string =>
  `${source.id}:${pageIndex}:${rotation}:${scale.toFixed(3)}`;

const abortError = (): DOMException => new DOMException("Aborted", "AbortError");

/** Mirrors pdf.js `PageViewport` for a MediaBox of `[0 0 w h]`, no userUnit, no offset. */
export function getViewportTransform(
  size: PageSize,
  intrinsic: Rotation,
  virtual: Rotation,
  scale: number,
): Matrix {
  const s = scale;
  switch (addRotation(intrinsic, virtual)) {
    case Rotation.R90:
      return [0, s, s, 0, 0, 0];
    case Rotation.R180:
      return [-s, 0, 0, s, size.w * s, 0];
    case Rotation.R270:
      return [0, -s, -s, 0, size.h * s, size.w * s];
    default:
      return [s, 0, 0, -s, 0, size.h * s];
  }
}

export function getViewportSize(
  size: PageSize,
  intrinsic: Rotation,
  virtual: Rotation,
  scale: number,
): { width: number; height: number } {
  const total = addRotation(intrinsic, virtual);
  const swap = total === Rotation.R90 || total === Rotation.R270;
  return { width: (swap ? size.h : size.w) * scale, height: (swap ? size.w : size.h) * scale };
}

export function renderPage(req: RenderRequest, signal?: AbortSignal): Promise<Rendered> {
  if (signal?.aborted) return Promise.reject(abortError());
  const key = cacheKey(req);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit);
  }
  const flight = inflight.get(key) ?? startFlight(key, req);
  flight.waiters++;
  if (!signal) return flight.promise;
  return new Promise<Rendered>((resolve, reject) => {
    const onAbort = () => {
      if (--flight.waiters === 0) {
        // Unregister first so a re-request in the same tick starts a fresh flight.
        if (inflight.get(key) === flight) inflight.delete(key);
        flight.controller.abort();
      }
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    flight.promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function startFlight(key: string, req: RenderRequest): Flight {
  const controller = new AbortController();
  const flight: Flight = {
    controller,
    waiters: 0,
    promise: draw(req, controller.signal).then(
      (rendered) => {
        // Only a flight still registered under its key caches; `clearRenderCache` unregisters.
        if (inflight.get(key) === flight) {
          inflight.delete(key);
          put(key, rendered);
        }
        return rendered;
      },
      (err: unknown) => {
        if (inflight.get(key) === flight) inflight.delete(key);
        throw err;
      },
    ),
  };
  flight.promise.catch(() => undefined);
  inflight.set(key, flight);
  return flight;
}

function put(key: string, rendered: Rendered): void {
  cache.set(key, rendered);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function clearRenderCache(sourceId?: string): void {
  if (sourceId === undefined) {
    cache.clear();
    inflight.clear();
    return;
  }
  const prefix = `${sourceId}:`;
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
  for (const key of inflight.keys()) if (key.startsWith(prefix)) inflight.delete(key);
}

async function drawWithPdfjs(req: RenderRequest, signal: AbortSignal): Promise<Rendered> {
  const doc = await getSourceDocument(req.source);
  const page = await doc.getPage(req.pageIndex + 1);
  if (signal.aborted) throw abortError();
  // `rotation` replaces page.rotate, so it must be the total rotation.
  const viewport = page.getViewport({ scale: req.scale, rotation: req.rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("renderPage: 2d canvas context unavailable");
  const task = page.render({ canvas, canvasContext: ctx, viewport });
  const cancel = () => task.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    await task.promise;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
  const t = viewport.transform;
  return {
    canvas,
    width: viewport.width,
    height: viewport.height,
    transform: [t[0], t[1], t[2], t[3], t[4], t[5]],
  };
}

export function _setDrawForTests(fn: Draw | null): void {
  draw = fn ?? drawWithPdfjs;
  cache.clear();
  inflight.clear();
}
