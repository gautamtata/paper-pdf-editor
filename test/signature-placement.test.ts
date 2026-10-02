import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeSignature, SIGNATURE_WIDTH } from "@/components/editor/actions";
import { AnnotationKind, type ImageAnnotation } from "@/lib/annotations/types";
import { Tool, editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace, TINY_PNG } from "@/test/fixtures";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const placed = (pageIndex: number): ImageAnnotation | undefined => {
  const page = workspaceStore.getState().workspace?.pages[pageIndex];
  const annotation = page?.annotations.at(-1);
  return annotation?.kind === AnnotationKind.Image ? annotation : undefined;
};

describe("placeSignature", () => {
  beforeEach(() => {
    workspaceStore.getState().load(makeWorkspace(3));
    editorStore.setState({ tool: Tool.Signature, activePageId: null, selectedAnnotation: null });
  });

  it("centres the signature on the page in view", () => {
    const pages = workspaceStore.getState().workspace?.pages ?? [];
    editorStore.getState().setActivePage(pages[1].id);

    placeSignature(TINY_PNG, 2);

    // Page 1 is 401x600pt; a 180pt-wide signature at aspect 2 is 90pt tall.
    expect(placed(1)?.rect).toEqual({ x: (401 - 180) / 2, y: (600 - 90) / 2, w: 180, h: 90 });
    expect(placed(1)?.aspect).toBe(2);
  });

  it("falls back to the first page when nothing is in view", () => {
    placeSignature(TINY_PNG, 1);
    expect(placed(0)).toBeDefined();
  });

  it("selects what it placed and hands back the Select tool", () => {
    placeSignature(TINY_PNG, 1);
    const pages = workspaceStore.getState().workspace?.pages ?? [];
    expect(editorStore.getState().selectedAnnotation).toEqual({
      pageId: pages[0].id,
      id: placed(0)?.id,
    });
    expect(editorStore.getState().tool).toBe(Tool.Select);
  });

  it("narrows a signature too tall for the page rather than cropping it", () => {
    placeSignature(TINY_PNG, 0.1);
    const rect = placed(0)?.rect;
    if (rect === undefined) throw new Error("nothing was placed");
    expect(rect.h).toBeLessThanOrEqual(600);
    expect(rect.w).toBeLessThan(SIGNATURE_WIDTH);
    expect(rect.w / rect.h).toBeCloseTo(0.1, 5);
  });

  it("ignores an aspect that makes no sense", () => {
    placeSignature(TINY_PNG, 0);
    expect(placed(0)).toBeUndefined();
  });
});
