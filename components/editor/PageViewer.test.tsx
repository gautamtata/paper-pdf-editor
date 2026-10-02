// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePageCanvas } from "@/components/editor/usePageCanvas";
import { createRect } from "@/lib/annotations/types";
import { editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace } from "@/test/fixtures";
import { PageViewer } from "./PageViewer";
import { ThumbnailRail } from "./ThumbnailRail";

// The hook runs once per render of the component that owns a canvas, so its calls count renders.
vi.mock("@/components/editor/usePageCanvas", () => ({
  usePageCanvas: vi.fn(() => ({
    canvasRef: { current: null },
    painted: false,
    failed: false,
    retry: () => undefined,
  })),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

afterEach(cleanup);

const rendersOfPage = (index: number): number =>
  vi.mocked(usePageCanvas).mock.calls.filter(([req]) => req.pageIndex === index).length;

beforeEach(() => {
  workspaceStore.getState().load(makeWorkspace(3, "lease"));
  editorStore.getState().clearSelection();
  vi.mocked(usePageCanvas).mockClear();
});

describe("per-frame re-rendering", () => {
  it("re-renders only the dragged page's view during a transient annotation update", () => {
    render(<PageViewer onDisplayScale={() => undefined} />);
    const [first] = workspaceStore.getState().workspace?.pages ?? [];
    const rect = createRect({ x: 1, y: 2, w: 3, h: 4 });
    act(() => workspaceStore.getState().addAnnotation(first.id, rect));
    const before = [rendersOfPage(0), rendersOfPage(1), rendersOfPage(2)];

    for (let i = 0; i < 5; i++) {
      act(() =>
        workspaceStore
          .getState()
          .updateAnnotation(first.id, rect.id, { rect: { ...rect.rect, x: 10 + i } }, { transient: true }),
      );
    }
    expect(rendersOfPage(0)).toBe(before[0] + 5);
    expect(rendersOfPage(1)).toBe(before[1]);
    expect(rendersOfPage(2)).toBe(before[2]);
  });

  it("leaves the untouched thumbnail cards alone too", () => {
    render(<ThumbnailRail />);
    const [first] = workspaceStore.getState().workspace?.pages ?? [];
    const rect = createRect({ x: 1, y: 2, w: 3, h: 4 });
    act(() => workspaceStore.getState().addAnnotation(first.id, rect));
    const before = [rendersOfPage(1), rendersOfPage(2)];

    act(() =>
      workspaceStore.getState().updateAnnotation(first.id, rect.id, { rect: { ...rect.rect, x: 20 } }, { transient: true }),
    );
    expect(rendersOfPage(1)).toBe(before[0]);
    expect(rendersOfPage(2)).toBe(before[1]);
  });
});
