// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace } from "@/test/fixtures";
import { ThumbnailRail } from "./ThumbnailRail";

// The real renderer needs pdf.js and a GPU-backed canvas; sizes stay pure so cards still lay out.
vi.mock("@/lib/render/renderer", () => ({
  renderPage: vi.fn(() =>
    Promise.resolve({
      canvas: document.createElement("canvas"),
      width: 120,
      height: 180,
      transform: [1, 0, 0, -1, 0, 180],
    }),
  ),
  getViewportSize: (size: { w: number; h: number }, _i: number, _v: number, scale: number) => ({
    width: size.w * scale,
    height: size.h * scale,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

afterEach(cleanup);

const selected = (): string[] => [...editorStore.getState().selectedPageIds];

beforeEach(() => {
  workspaceStore.getState().load(makeWorkspace(5, "lease"));
  editorStore.getState().clearSelection();
});

describe("ThumbnailRail", () => {
  it("renders one card per page, numbered in order", () => {
    render(<ThumbnailRail />);

    const cards = screen.getAllByTestId("thumbnail");
    expect(cards).toHaveLength(5);
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Page 1",
      "Page 2",
      "Page 3",
      "Page 4",
      "Page 5",
    ]);
  });

  it("replaces the selection on click and extends it on shift-click", () => {
    render(<ThumbnailRail />);
    const ids = workspaceStore.getState().workspace?.pages.map((p) => p.id) ?? [];
    const cards = screen.getAllByTestId("thumbnail");

    fireEvent.click(cards[3]);
    expect(selected()).toEqual([ids[3]]);

    fireEvent.click(cards[1]);
    expect(selected()).toEqual([ids[1]]);

    fireEvent.click(cards[3], { shiftKey: true });
    expect(selected()).toEqual([ids[1], ids[2], ids[3]]);
  });

  it("toggles a single card with the meta key", () => {
    render(<ThumbnailRail />);
    const ids = workspaceStore.getState().workspace?.pages.map((p) => p.id) ?? [];
    const cards = screen.getAllByTestId("thumbnail");

    fireEvent.click(cards[0]);
    fireEvent.click(cards[2], { metaKey: true });
    expect(selected()).toEqual([ids[0], ids[2]]);

    fireEvent.click(cards[2], { metaKey: true });
    expect(selected()).toEqual([ids[0]]);
  });

  it("marks the selected cards for assistive technology", () => {
    render(<ThumbnailRail />);
    const cards = screen.getAllByTestId("thumbnail");

    fireEvent.click(cards[2]);
    expect(cards.map((card) => card.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ]);
  });
});
