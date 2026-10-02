// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tool, editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace } from "@/test/fixtures";
import { useShortcuts } from "./useShortcuts";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

function Probe() {
  useShortcuts();
  return <input data-testid="field" />;
}

afterEach(cleanup);

const pageIds = (): string[] => workspaceStore.getState().workspace?.pages.map((p) => p.id) ?? [];

beforeEach(() => {
  workspaceStore.getState().load(makeWorkspace(5, "lease"));
  editorStore.getState().clearSelection();
  editorStore.getState().setTool(Tool.Select);
  editorStore.getState().setSelectedAnnotation(null);
});

describe("useShortcuts", () => {
  it("deletes the selected pages on Delete", () => {
    render(<Probe />);
    const [first, second] = pageIds();
    editorStore.getState().selectPage(first, "replace", pageIds());
    editorStore.getState().selectPage(second, "toggle", pageIds());

    fireEvent.keyDown(document, { key: "Delete" });

    expect(pageIds()).toHaveLength(3);
    expect(pageIds()).not.toContain(first);
    expect(pageIds()).not.toContain(second);
  });

  it("ignores Delete while typing in a field", () => {
    render(<Probe />);
    editorStore.getState().selectPage(pageIds()[0], "replace", pageIds());

    const field = screen.getByTestId("field");
    field.focus();
    fireEvent.keyDown(field, { key: "Delete" });

    expect(pageIds()).toHaveLength(5);
  });

  it("undoes a delete on meta-z", () => {
    render(<Probe />);
    editorStore.getState().selectPage(pageIds()[0], "replace", pageIds());

    fireEvent.keyDown(document, { key: "Delete" });
    expect(pageIds()).toHaveLength(4);

    fireEvent.keyDown(document, { key: "z", metaKey: true });
    expect(pageIds()).toHaveLength(5);
  });

  it("rotates the selection with R and picks the rect tool when nothing is selected", () => {
    render(<Probe />);
    const [first] = pageIds();
    editorStore.getState().selectPage(first, "replace", pageIds());

    fireEvent.keyDown(document, { key: "r" });
    expect(workspaceStore.getState().workspace?.pages[0].rotation).toBe(90);
    expect(editorStore.getState().tool).toBe(Tool.Select);

    editorStore.getState().clearSelection();
    fireEvent.keyDown(document, { key: "r" });
    expect(editorStore.getState().tool).toBe(Tool.Rect);
    expect(workspaceStore.getState().workspace?.pages[0].rotation).toBe(90);
  });

  it("selects every page on meta-a and clears it on Escape", () => {
    render(<Probe />);

    fireEvent.keyDown(document, { key: "a", metaKey: true });
    expect(editorStore.getState().selectedPageIds.size).toBe(5);

    editorStore.getState().setTool(Tool.Pen);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(editorStore.getState().selectedPageIds.size).toBe(0);
    expect(editorStore.getState().tool).toBe(Tool.Select);
  });
});
