import { describe, expect, it } from "vitest";
import { cn, formatBytes, pngDataUrl } from "@/lib/utils";
import { TINY_PNG } from "@/test/fixtures";

describe("utils", () => {
  it("merges tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("encodes PNG bytes as a data URL", () => {
    const url = pngDataUrl(TINY_PNG);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(Uint8Array.from(atob(url.slice(22)), (c) => c.charCodeAt(0))).toEqual(TINY_PNG);
  });

  it("encodes an image larger than one chunk", () => {
    const big = new Uint8Array(0x8000 * 2 + 17).fill(200);
    expect(Uint8Array.from(atob(pngDataUrl(big).slice(22)), (c) => c.charCodeAt(0))).toEqual(big);
  });
});
