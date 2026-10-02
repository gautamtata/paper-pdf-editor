import { beforeEach, describe, expect, it } from "vitest";
import { editorStore, Tool } from "@/lib/store/editor";

const order = ["p0", "p1", "p2", "p3", "p4"];

const selected = (): string[] => [...editorStore.getState().selectedPageIds];

beforeEach(() => {
  editorStore.setState(editorStore.getInitialState(), true);
});

describe("defaults", () => {
  it("starts in Select with a fit-width 100% view and no selection", () => {
    const s = editorStore.getState();

    expect(s.tool).toBe(Tool.Select);
    expect(s.zoom).toBe(1);
    expect(s.zoomMode).toBe("fit-width");
    expect(s.selectedPageIds.size).toBe(0);
    expect(s.activePageId).toBeNull();
    expect(s.selectedAnnotation).toBeNull();
    expect(s.penColor).toEqual({ r: 0, g: 0, b: 0 });
    expect(s.penSize).toBe(3);
    expect(s.textColor).toEqual({ r: 0, g: 0, b: 0 });
    expect(s.fontSize).toBe(14);
    expect(s.highlightColor).toEqual({ r: 1, g: 0.9, b: 0.2 });
  });
});

describe("setTool", () => {
  it("switches the active tool", () => {
    editorStore.getState().setTool(Tool.Pen);

    expect(editorStore.getState().tool).toBe(Tool.Pen);
  });
});

describe("selectPage", () => {
  it("replaces the selection", () => {
    editorStore.getState().selectPage("p1", "toggle", order);
    editorStore.getState().selectPage("p3", "replace", order);

    expect(selected()).toEqual(["p3"]);
  });

  it("toggles an id in and out of the selection", () => {
    editorStore.getState().selectPage("p1", "toggle", order);
    editorStore.getState().selectPage("p2", "toggle", order);
    expect(selected()).toEqual(["p1", "p2"]);

    editorStore.getState().selectPage("p1", "toggle", order);
    expect(selected()).toEqual(["p2"]);
  });

  it("selects the inclusive range from the anchor forwards", () => {
    editorStore.getState().selectPage("p1", "replace", order);
    editorStore.getState().selectPage("p3", "range", order);

    expect(selected()).toEqual(["p1", "p2", "p3"]);
  });

  it("selects the inclusive range from the anchor backwards", () => {
    editorStore.getState().selectPage("p3", "replace", order);
    editorStore.getState().selectPage("p1", "range", order);

    expect(selected()).toEqual(["p1", "p2", "p3"]);
  });

  it("keeps the anchor so a second range click re-anchors from the same page", () => {
    editorStore.getState().selectPage("p2", "replace", order);
    editorStore.getState().selectPage("p4", "range", order);
    editorStore.getState().selectPage("p0", "range", order);

    expect(selected()).toEqual(["p0", "p1", "p2"]);
  });

  it("falls back to replace when there is no anchor", () => {
    editorStore.getState().selectPage("p2", "range", order);

    expect(selected()).toEqual(["p2"]);
  });

  it("falls back to replace when the anchor is gone from the order", () => {
    editorStore.getState().selectPage("gone", "replace", order);
    editorStore.getState().selectPage("p2", "range", order);

    expect(selected()).toEqual(["p2"]);
  });
});

describe("selectAll / clearSelection", () => {
  it("selects every page in order and then clears", () => {
    editorStore.getState().selectAll(order);
    expect(selected()).toEqual(order);

    editorStore.getState().clearSelection();
    expect(selected()).toEqual([]);
  });

  it("drops the anchor on clear", () => {
    editorStore.getState().selectPage("p1", "replace", order);
    editorStore.getState().clearSelection();
    editorStore.getState().selectPage("p3", "range", order);

    expect(selected()).toEqual(["p3"]);
  });
});

describe("active page and annotation", () => {
  it("tracks the most visible page and the selected annotation", () => {
    editorStore.getState().setActivePage("p2");
    editorStore.getState().setSelectedAnnotation({ pageId: "p2", id: "a1" });
    expect(editorStore.getState().activePageId).toBe("p2");
    expect(editorStore.getState().selectedAnnotation).toEqual({ pageId: "p2", id: "a1" });

    editorStore.getState().setActivePage(null);
    editorStore.getState().setSelectedAnnotation(null);
    expect(editorStore.getState().activePageId).toBeNull();
    expect(editorStore.getState().selectedAnnotation).toBeNull();
  });
});

describe("zoom", () => {
  it("clamps to 0.25..4 and switches to custom", () => {
    editorStore.getState().setZoom(2.5);
    expect(editorStore.getState().zoom).toBe(2.5);
    expect(editorStore.getState().zoomMode).toBe("custom");

    editorStore.getState().setZoom(99);
    expect(editorStore.getState().zoom).toBe(4);

    editorStore.getState().setZoom(0.01);
    expect(editorStore.getState().zoom).toBe(0.25);
  });

  it("sets the zoom mode without touching the zoom factor", () => {
    editorStore.getState().setZoom(2);
    editorStore.getState().setZoomMode("fit-page");

    expect(editorStore.getState().zoomMode).toBe("fit-page");
    expect(editorStore.getState().zoom).toBe(2);
  });
});

describe("setToolSetting", () => {
  it("writes each tool setting", () => {
    editorStore.getState().setToolSetting("penColor", { r: 1, g: 0, b: 0 });
    editorStore.getState().setToolSetting("penSize", 8);
    editorStore.getState().setToolSetting("textColor", { r: 0, g: 0, b: 1 });
    editorStore.getState().setToolSetting("fontSize", 24);
    editorStore.getState().setToolSetting("highlightColor", { r: 0, g: 1, b: 0 });

    const s = editorStore.getState();
    expect(s.penColor).toEqual({ r: 1, g: 0, b: 0 });
    expect(s.penSize).toBe(8);
    expect(s.textColor).toEqual({ r: 0, g: 0, b: 1 });
    expect(s.fontSize).toBe(24);
    expect(s.highlightColor).toEqual({ r: 0, g: 1, b: 0 });
  });
});
