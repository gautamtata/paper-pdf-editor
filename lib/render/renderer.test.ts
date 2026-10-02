// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { getSourceDocument, releaseSource } from "@/lib/render/pdfjs";
import {
  _setDrawForTests,
  clearRenderCache,
  getViewportSize,
  getViewportTransform,
  removeSource,
  renderPage,
  type Rendered,
  type RenderRequest,
} from "@/lib/render/renderer";
import { applyMatrix } from "@/lib/annotations/geometry";
import { addRotation, Rotation, type SourceDoc } from "@/lib/pdf/types";
import { GARBAGE, makeCroppedPdf, makePdf, makeRotatedPdf } from "@/test/fixtures";

const ROTATIONS = [Rotation.R0, Rotation.R90, Rotation.R180, Rotation.R270];
const SIZE = { w: 400, h: 600 };

function source(id: string, bytes: Uint8Array, rotation = Rotation.R0): SourceDoc {
  return { id, name: `${id}.pdf`, bytes, pageCount: 1, pages: [{ size: SIZE, origin: { x: 0, y: 0 }, rotation }] };
}

const stub = (): Rendered => ({
  canvas: {} as HTMLCanvasElement,
  width: 1,
  height: 1,
  transform: [1, 0, 0, 1, 0, 0],
});

afterEach(() => {
  _setDrawForTests(null);
  clearRenderCache();
});

describe("getViewportTransform", () => {
  it("matches pdf.js for every total rotation and scale", async () => {
    const src = source("plain", await makePdf(1));
    const page = await (await getSourceDocument(src)).getPage(1);
    for (const rotation of ROTATIONS) {
      for (const scale of [1, 1.5]) {
        const expected = page.getViewport({ scale, rotation });
        expect(getViewportTransform(SIZE, Rotation.R0, rotation, scale)).toEqual(expected.transform);
        expect(getViewportSize(SIZE, Rotation.R0, rotation, scale)).toEqual({
          width: expected.width,
          height: expected.height,
        });
      }
    }
    releaseSource(src.id);
  });

  it("composes intrinsic and virtual rotation the way pdf.js replaces page.rotate", async () => {
    const src = source("rot", await makeRotatedPdf(Rotation.R90), Rotation.R90);
    const page = await (await getSourceDocument(src)).getPage(1);
    expect(page.rotate).toBe(90);
    // An explicit `rotation` replaces, not adds to, the intrinsic /Rotate.
    expect(page.getViewport({ scale: 1, rotation: 0 }).transform).toEqual(
      getViewportTransform(SIZE, Rotation.R0, Rotation.R0, 1),
    );
    for (const virtual of ROTATIONS) {
      const total = addRotation(Rotation.R90, virtual);
      expect(getViewportTransform(SIZE, Rotation.R90, virtual, 2)).toEqual(
        page.getViewport({ scale: 2, rotation: total }).transform,
      );
    }
    releaseSource(src.id);
  });
});

describe("getViewportTransform on a cropped page", () => {
  it("maps box space onto pdf.js's user-space transform shifted by the CropBox origin", async () => {
    const size = { w: 300, h: 500 };
    const origin = { x: 50, y: 50 };
    const src: SourceDoc = {
      id: "crop",
      name: "crop.pdf",
      bytes: await makeCroppedPdf(),
      pageCount: 1,
      pages: [{ size, origin, rotation: Rotation.R0 }],
    };
    const page = await (await getSourceDocument(src)).getPage(1);
    expect(page.view).toEqual([50, 50, 350, 550]);
    for (const rotation of ROTATIONS) {
      const viewport = page.getViewport({ scale: 1.5, rotation });
      const ours = getViewportTransform(size, Rotation.R0, rotation, 1.5);
      expect(getViewportSize(size, Rotation.R0, rotation, 1.5)).toEqual({
        width: viewport.width,
        height: viewport.height,
      });
      for (const [bx, by] of [
        [0, 0],
        [300, 500],
        [10, 10],
      ]) {
        const expected = viewport.convertToViewportPoint(bx + origin.x, by + origin.y);
        const [x, y] = applyMatrix(ours, bx, by);
        expect(x).toBeCloseTo(expected[0]);
        expect(y).toBeCloseTo(expected[1]);
      }
    }
    releaseSource(src.id);
  });
});

describe("renderPage cache", () => {
  const req = (pageIndex: number, id = "s"): RenderRequest => ({
    source: source(id, new Uint8Array()),
    pageIndex,
    rotation: Rotation.R0,
    scale: 1,
  });

  it("returns the same object on a cache hit and distinct objects per key", async () => {
    _setDrawForTests(async () => stub());
    const a = await renderPage(req(0));
    expect(await renderPage(req(0))).toBe(a);
    expect(await renderPage(req(1))).not.toBe(a);
    expect(await renderPage({ ...req(0), scale: 1.0004 })).toBe(a);
    expect(await renderPage({ ...req(0), rotation: Rotation.R90 })).not.toBe(a);
  });

  it("evicts the least recently used entry after 80 inserts", async () => {
    let draws = 0;
    _setDrawForTests(async () => {
      draws++;
      return stub();
    });
    const first = await renderPage(req(0));
    for (let i = 1; i < 80; i++) await renderPage(req(i));
    expect(await renderPage(req(0))).toBe(first); // touch: now most recent
    await renderPage(req(80)); // evicts page 1, not page 0
    expect(draws).toBe(81);
    expect(await renderPage(req(0))).toBe(first);
    await renderPage(req(1));
    expect(draws).toBe(82);
  });

  it("dedupes in-flight renders", async () => {
    let draws = 0;
    let release!: () => void;
    _setDrawForTests(() => {
      draws++;
      return new Promise<Rendered>((resolve) => {
        release = () => resolve(stub());
      });
    });
    const p1 = renderPage(req(0));
    const p2 = renderPage(req(0));
    release();
    expect(await p1).toBe(await p2);
    expect(draws).toBe(1);
  });

  it("rejects with AbortError and cancels the draw when every waiter aborts", async () => {
    let drawSignal: AbortSignal | undefined;
    _setDrawForTests(
      (_r, signal) =>
        new Promise<Rendered>((_resolve, reject) => {
          drawSignal = signal;
          signal?.addEventListener("abort", () => reject(new Error("cancelled")));
        }),
    );
    const ctrl = new AbortController();
    const p = renderPage(req(0), ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(drawSignal?.aborted).toBe(true);

    const already = new AbortController();
    already.abort();
    await expect(renderPage(req(1), already.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("starts a fresh flight when re-requested right after the sole waiter aborts", async () => {
    let draws = 0;
    _setDrawForTests(
      (_r, signal) =>
        new Promise<Rendered>((resolve, reject) => {
          draws++;
          signal.addEventListener("abort", () => reject(new Error("cancelled")));
          if (draws === 2) resolve(stub());
        }),
    );
    const ctrl = new AbortController();
    const first = renderPage(req(0), ctrl.signal);
    ctrl.abort();
    const second = renderPage(req(0));
    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    expect((await second).width).toBe(1);
    expect(draws).toBe(2);
  });

  it("keeps drawing for the remaining waiter when only one aborts", async () => {
    let drawSignal: AbortSignal | undefined;
    let release!: () => void;
    _setDrawForTests((_r, signal) => {
      drawSignal = signal;
      return new Promise<Rendered>((resolve) => {
        release = () => resolve(stub());
      });
    });
    const ctrl = new AbortController();
    const aborted = renderPage(req(0), ctrl.signal);
    const kept = renderPage(req(0));
    ctrl.abort();
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    expect(drawSignal?.aborted).toBe(false);
    release();
    expect((await kept).width).toBe(1);
  });

  it("does not cache a render that failed, and clearRenderCache(id) skips caching in-flight ones", async () => {
    let draws = 0;
    _setDrawForTests(async () => {
      draws++;
      if (draws === 1) throw new Error("boom");
      return stub();
    });
    await expect(renderPage(req(0))).rejects.toThrow("boom");
    await renderPage(req(0));
    expect(draws).toBe(2);

    let release!: () => void;
    _setDrawForTests(() => {
      draws++;
      return new Promise<Rendered>((resolve) => {
        release = () => resolve(stub());
      });
    });
    const p = renderPage(req(5, "other"));
    clearRenderCache("other");
    release();
    await p;
    const again = renderPage(req(5, "other"));
    release();
    await again;
    expect(draws).toBe(4);
  });
});

describe("source documents", () => {
  it("forgets a document that failed to open, so a retry can succeed", async () => {
    const bad = source("flaky", GARBAGE);
    await expect(getSourceDocument(bad)).rejects.toBeDefined();
    const good = source("flaky", await makePdf(1));
    expect((await getSourceDocument(good)).numPages).toBe(1);
    releaseSource("flaky");
  });

  it("removeSource drops the document and every bitmap rendered from it", async () => {
    let draws = 0;
    _setDrawForTests(async () => {
      draws++;
      return stub();
    });
    const req: RenderRequest = {
      source: source("gone", new Uint8Array()),
      pageIndex: 0,
      rotation: Rotation.R0,
      scale: 1,
    };
    const other: RenderRequest = { ...req, source: source("kept", new Uint8Array()) };
    await renderPage(req);
    await renderPage(other);
    removeSource("gone");
    await renderPage(req);
    await renderPage(other);
    expect(draws).toBe(3);
  });
});
