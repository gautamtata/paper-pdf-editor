import { describe, expect, it } from "vitest";
import { exportFilename } from "@/components/editor/ExportButton";

describe("exportFilename", () => {
  it("keeps a usable name and adds the extension", () => {
    expect(exportFilename("Lease + 2 more")).toBe("Lease + 2 more.pdf");
  });

  it("drops characters a filesystem would refuse", () => {
    expect(exportFilename('a/b:c*d?e"f<g>h|i')).toBe("a b c d e f g h i.pdf");
  });

  it("drops control characters", () => {
    expect(exportFilename("a\x00b\x1fc")).toBe("a b c.pdf");
  });

  it("keeps a hyphen, which the control-character range must not swallow", () => {
    expect(exportFilename("quarter-end")).toBe("quarter-end.pdf");
  });

  it("drops leading dots, which would hide the download", () => {
    expect(exportFilename("...invoice")).toBe("invoice.pdf");
  });

  it("falls back when nothing usable is left", () => {
    expect(exportFilename("  ///  ")).toBe("document.pdf");
  });
});
