import { describe, expect, it } from "vitest";
import { typedSignatureSvg } from "@/lib/signature/typed";

const BLUE_INK = { r: 0.13, g: 0.18, b: 0.28 };

describe("typedSignatureSvg", () => {
  it("writes the text into the SVG", () => {
    expect(typedSignatureSvg("Ada Lovelace", BLUE_INK)).toContain(">Ada Lovelace<");
  });

  it("sets the hand font at 72px", () => {
    const svg = typedSignatureSvg("Ada", BLUE_INK);
    expect(svg).toContain('font-family="Caveat Variable, cursive"');
    expect(svg).toContain('font-size="72"');
  });

  it("fills with the chosen ink", () => {
    expect(typedSignatureSvg("Ada", { r: 1, g: 0, b: 0 })).toContain('fill="rgb(255 0 0)"');
  });

  it("is a standalone SVG document, sized to hold the text", () => {
    const svg = typedSignatureSvg("Ada Lovelace", BLUE_INK);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    const width = Number(/width="(\d+)"/.exec(svg)?.[1]);
    const longer = Number(/width="(\d+)"/.exec(typedSignatureSvg("Ada Lovelace Jr", BLUE_INK))?.[1]);
    expect(width).toBeGreaterThan(0);
    expect(longer).toBeGreaterThan(width);
  });

  it("escapes markup in the name so the SVG stays parseable", () => {
    const svg = typedSignatureSvg('A & B <"c">', BLUE_INK);
    expect(svg).toContain("A &amp; B &lt;&quot;c&quot;&gt;");
    expect(svg).not.toContain('B <"c">');
  });
});
