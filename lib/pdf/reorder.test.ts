import { describe, expect, it } from "vitest";
import { movePages } from "@/lib/pdf/ops";
import { computeDropIndex } from "@/lib/pdf/reorder";
import { Rotation, type VirtualPage } from "@/lib/pdf/types";

const page = (id: string): VirtualPage => ({
  id,
  sourceId: "src",
  sourceIndex: 0,
  rotation: Rotation.R0,
  size: { w: 400, h: 600 },
  annotations: [],
});

const pages = ["a", "b", "c", "d"].map(page);
const order = pages.map((p) => p.id);

/** The order `movePages` produces for a drop of `movingIds` onto `overId`. */
const dropped = (movingIds: string[], overId: string): string[] => {
  const to = computeDropIndex(order, movingIds, overId);
  expect(to).not.toBeNull();
  return movePages(pages, movingIds, to ?? 0).map((p) => p.id);
};

describe("computeDropIndex", () => {
  it("moves a later block onto an earlier card", () => {
    expect(computeDropIndex(order, ["c", "d"], "b")).toBe(1);
    expect(dropped(["c", "d"], "b")).toEqual(["a", "c", "d", "b"]);
  });

  it("moves an earlier block onto a later card, discounting the cards it left behind", () => {
    expect(computeDropIndex(order, ["a", "b"], "d")).toBe(1);
    expect(dropped(["a", "b"], "d")).toEqual(["c", "a", "b", "d"]);
  });

  it("moves a single card onto the front", () => {
    expect(dropped(["c"], "a")).toEqual(["c", "a", "b", "d"]);
  });

  it("is a no-op when the block is dropped on itself", () => {
    expect(computeDropIndex(order, ["b", "c"], "c")).toBeNull();
    expect(computeDropIndex(order, ["b"], "b")).toBeNull();
  });

  it("is a no-op without a moving block or a known target", () => {
    expect(computeDropIndex(order, [], "b")).toBeNull();
    expect(computeDropIndex(order, ["a"], "zzz")).toBeNull();
  });
});
