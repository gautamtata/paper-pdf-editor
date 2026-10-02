import { describe, expect, it } from "vitest";
import { contentBounds, thresholdToTransparent } from "@/lib/signature/image";

/** `[r, g, b, a]` per pixel, row-major: the layout `getImageData` hands back. */
const pixels = (...rgba: number[][]): Uint8ClampedArray =>
  new Uint8ClampedArray(rgba.flat());

const alphas = (data: Uint8ClampedArray): number[] =>
  Array.from({ length: data.length / 4 }, (_, i) => data[i * 4 + 3]);

const WHITE = [255, 255, 255, 255];
const PAPER = [248, 246, 240, 255];
const INK = [20, 24, 40, 255];
const MID = [128, 128, 128, 255];

describe("thresholdToTransparent", () => {
  it("drops white and near-white pixels to fully transparent", () => {
    const data = pixels(WHITE, PAPER);
    thresholdToTransparent(data);
    expect(alphas(data)).toEqual([0, 0]);
  });

  it("keeps dark pixels fully opaque, with their colour untouched", () => {
    const data = pixels(INK);
    thresholdToTransparent(data);
    expect(alphas(data)).toEqual([255]);
    expect([data[0], data[1], data[2]]).toEqual(INK.slice(0, 3));
  });

  it("gives midtones a partial alpha, for a soft edge rather than a jagged one", () => {
    const data = pixels(MID);
    thresholdToTransparent(data);
    const [alpha] = alphas(data);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
  });

  it("darker pixels end up more opaque than lighter ones", () => {
    const data = pixels([60, 60, 60, 255], [170, 170, 170, 255]);
    thresholdToTransparent(data);
    const [dark, light] = alphas(data);
    expect(dark).toBeGreaterThan(light);
  });

  it("weights green most and blue least, as luminance does", () => {
    const data = pixels([0, 255, 0, 255], [0, 0, 255, 255]);
    thresholdToTransparent(data);
    const [green, blue] = alphas(data);
    expect(blue).toBe(255);
    expect(green).toBeLessThan(blue / 2);
  });
});

describe("contentBounds", () => {
  it("returns the bbox of the pixels that have any alpha left", () => {
    // 4x3, ink at (1,1) and (2,2).
    const clear = [0, 0, 0, 0];
    const mark = [0, 0, 0, 255];
    const data = pixels(
      clear, clear, clear, clear,
      clear, mark, clear, clear,
      clear, clear, mark, clear,
    );
    expect(contentBounds(data, 4, 3)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
  });

  it("covers a single pixel with a 1x1 box", () => {
    const data = pixels([0, 0, 0, 0], [0, 0, 0, 1]);
    expect(contentBounds(data, 2, 1)).toEqual({ x: 1, y: 0, w: 1, h: 1 });
  });

  it("returns null when every pixel is transparent", () => {
    const data = new Uint8ClampedArray(4 * 9);
    expect(contentBounds(data, 3, 3)).toBeNull();
  });
});
