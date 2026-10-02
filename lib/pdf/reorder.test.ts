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

const pages = ["a", "b", "c", "d", "e"].map(page);
const order = pages.map((p) => p.id);

/** The order `movePages` produces for a drop of `movingIds` onto `overId`. */
const dropped = (movingIds: string[], overId: string): string[] => {
  const to = computeDropIndex(order, movingIds, overId);
  expect(to).not.toBeNull();
  return movePages(pages, movingIds, to ?? 0).map((p) => p.id);
};

describe("computeDropIndex", () => {
  it("swaps a card dragged one slot forward", () => {
    expect(computeDropIndex(order, ["a"], "b")).toBe(1);
    expect(dropped(["a"], "b")).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("swaps a card dragged one slot backward", () => {
    expect(computeDropIndex(order, ["c"], "b")).toBe(1);
    expect(dropped(["c"], "b")).toEqual(["a", "c", "b", "d", "e"]);
  });

  it("drops a card dragged forward past several cards after the one it landed on", () => {
    expect(dropped(["a"], "d")).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("drops a block dragged forward after the card it landed on", () => {
    expect(computeDropIndex(order, ["a", "b"], "d")).toBe(2);
    expect(dropped(["a", "b"], "d")).toEqual(["c", "d", "a", "b", "e"]);
  });

  it("drops a block dragged backward before the card it landed on", () => {
    expect(computeDropIndex(order, ["d", "e"], "b")).toBe(1);
    expect(dropped(["d", "e"], "b")).toEqual(["a", "d", "e", "b", "c"]);
  });

  it("keeps a block together when the cards it leaves behind are not adjacent", () => {
    expect(dropped(["a", "c"], "e")).toEqual(["b", "d", "e", "a", "c"]);
  });

  it("is a no-op when the block is dropped on itself", () => {
    expect(computeDropIndex(order, ["b", "c"], "c")).toBeNull();
    expect(computeDropIndex(order, ["b"], "b")).toBeNull();
  });

  it("is a no-op without a moving block or a known target", () => {
    expect(computeDropIndex(order, [], "b")).toBeNull();
    expect(computeDropIndex(order, ["a"], "zzz")).toBeNull();
    expect(computeDropIndex(order, ["zzz"], "a")).toBeNull();
  });
});
