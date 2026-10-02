import { describe, expect, it } from "vitest";
import {
  appendSource,
  deletePages,
  duplicatePages,
  extractPages,
  insertBlank,
  movePages,
  rotatePages,
  usedSourceIds,
} from "@/lib/pdf/ops";
import { Rotation, type SourceDoc, type VirtualPage } from "@/lib/pdf/types";

const mk = (n: number): VirtualPage[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    sourceId: "s",
    sourceIndex: i,
    rotation: Rotation.R0,
    size: { w: 100, h: 100 },
    annotations: [],
  }));

const ids = (p: VirtualPage[]) => p.map((x) => x.id);

const srcWith = (pageCount: number, id = "s2"): SourceDoc => ({
  id,
  name: `${id}.pdf`,
  bytes: new Uint8Array(),
  pageCount,
  pages: Array.from({ length: pageCount }, () => ({
    size: { w: 400, h: 600 },
    rotation: Rotation.R0,
  })),
});

describe("deletePages", () => {
  it("removes the selected pages and leaves the input untouched", () => {
    const input = mk(5);
    expect(ids(deletePages(input, ["p1", "p3"]))).toEqual(["p0", "p2", "p4"]);
    expect(input).toHaveLength(5);
  });

  it("ignores unknown ids", () => {
    expect(ids(deletePages(mk(2), ["zzz"]))).toEqual(["p0", "p1"]);
  });
});

describe("movePages", () => {
  it("moves a contiguous block to the front", () => {
    expect(ids(movePages(mk(5), ["p3", "p4"], 0))).toEqual(["p3", "p4", "p0", "p1", "p2"]);
  });

  it("clamps a toIndex beyond the remaining pages to the end", () => {
    expect(ids(movePages(mk(5), ["p0"], 4))).toEqual(["p1", "p2", "p3", "p4", "p0"]);
  });

  it("keeps the relative order of a non-contiguous selection", () => {
    expect(ids(movePages(mk(5), ["p1", "p3"], 1))).toEqual(["p0", "p1", "p3", "p2", "p4"]);
  });

  it("ignores unknown ids", () => {
    expect(ids(movePages(mk(3), ["zzz"], 0))).toEqual(["p0", "p1", "p2"]);
  });
});

describe("rotatePages", () => {
  it("accumulates rotation modulo 360", () => {
    const once = rotatePages(mk(1), ["p0"], Rotation.R90);
    expect(once[0].rotation).toBe(Rotation.R90);
    const twice = rotatePages(rotatePages(mk(1), ["p0"], Rotation.R270), ["p0"], Rotation.R90);
    expect(twice[0].rotation).toBe(Rotation.R0);
  });

  it("leaves unselected pages alone", () => {
    const out = rotatePages(mk(2), ["p1"], Rotation.R180);
    expect(out[0].rotation).toBe(Rotation.R0);
    expect(out[1].rotation).toBe(Rotation.R180);
  });
});

describe("duplicatePages", () => {
  it("inserts a fresh copy directly after its original", () => {
    const input = mk(3);
    input[1] = { ...input[1], annotations: [{ id: "a" }] };
    const out = duplicatePages(input, ["p1"]);
    expect(out).toHaveLength(4);
    expect(ids(out).slice(0, 2)).toEqual(["p0", "p1"]);
    expect(out[3].id).toBe("p2");
    const copy = out[2];
    expect(copy.id).not.toBe("p1");
    expect(copy.sourceIndex).toBe(1);
    expect(copy.annotations).toHaveLength(1);
    expect(copy.annotations[0].id).not.toBe("a");
    expect(input[1].annotations[0].id).toBe("a");
  });
});

describe("insertBlank", () => {
  it("inserts a source-less page at the index", () => {
    const out = insertBlank(mk(2), 1, { w: 612, h: 792 });
    expect(out).toHaveLength(3);
    expect(out[1].sourceId).toBeNull();
    expect(out[1].size).toEqual({ w: 612, h: 792 });
    expect(ids(out)[0]).toBe("p0");
    expect(ids(out)[2]).toBe("p1");
  });
});

describe("appendSource", () => {
  it("appends every source page at the end by default", () => {
    const src = srcWith(2);
    const out = appendSource(mk(1), src);
    expect(out).toHaveLength(3);
    expect(out.slice(1).map((p) => p.sourceId)).toEqual([src.id, src.id]);
  });

  it("inserts at the given index", () => {
    const src = srcWith(2);
    const out = appendSource(mk(2), src, 1);
    expect(out.map((p) => p.sourceId)).toEqual(["s", src.id, src.id, "s"]);
  });
});

describe("extractPages", () => {
  it("returns the selection in current order with fresh ids", () => {
    const out = extractPages(mk(4), ["p3", "p1"]);
    expect(out.map((p) => p.sourceIndex)).toEqual([1, 3]);
    expect(ids(out).some((id) => id === "p1" || id === "p3")).toBe(false);
  });
});

describe("usedSourceIds", () => {
  it("collects source ids and skips blank pages", () => {
    const pages = insertBlank(mk(2), 2, { w: 10, h: 10 });
    expect(usedSourceIds(pages)).toEqual(new Set(["s"]));
  });
});

describe("purity", () => {
  it("never mutates the input array or its pages", () => {
    const input = mk(4);
    const snapshot = structuredClone(input);
    deletePages(input, ["p1"]);
    movePages(input, ["p0", "p2"], 2);
    rotatePages(input, ["p0", "p1", "p2", "p3"], Rotation.R90);
    duplicatePages(input, ["p0"]);
    insertBlank(input, 0, { w: 1, h: 1 });
    appendSource(input, srcWith(1), 0);
    extractPages(input, ["p0"]);
    expect(input).toEqual(snapshot);
  });

  it("does not share nested size or annotation objects with the input", () => {
    const input = mk(1);
    input[0] = { ...input[0], annotations: [{ id: "a" }] };
    const copy = duplicatePages(input, ["p0"])[1];
    copy.size.w = 999;
    expect(input[0].size.w).toBe(100);
    expect(copy.annotations[0]).not.toBe(input[0].annotations[0]);
  });
});
