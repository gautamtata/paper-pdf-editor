// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnnotationKind,
  createRect,
  createText,
  type Annotation,
  type InkAnnotation,
} from "@/lib/annotations/types";
import type { Matrix } from "@/lib/annotations/geometry";
import { Tool, editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace } from "@/test/fixtures";
import { AnnotationLayer } from "./AnnotationLayer";

/** Page 0 of `makeWorkspace` is 400x600pt; at display scale 1 the layer is 400x600 CSS px. */
const WIDTH = 400;
const HEIGHT = 600;
const TRANSFORM: Matrix = [1, 0, 0, -1, 0, HEIGHT];

afterEach(cleanup);

beforeEach(() => {
  workspaceStore.getState().load(makeWorkspace(2, "lease"));
  editorStore.setState({ tool: Tool.Select, selectedAnnotation: null, editingAnnotation: null });
  // jsdom lays nothing out, so the layer's box has to be stubbed for pointer maths.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: WIDTH,
    bottom: HEIGHT,
    width: WIDTH,
    height: HEIGHT,
    toJSON: () => ({}),
  });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pageId = (): string => {
  const page = workspaceStore.getState().workspace?.pages[0];
  if (page === undefined) throw new Error("no page");
  return page.id;
};

/** Mid-test tool changes have to flush, the way the toolbar's own click would. */
const setTool = (tool: Tool): void => {
  act(() => {
    editorStore.setState({ tool });
  });
};

/** The text boxes open for editing, anywhere in the document. */
const openBoxes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-slot=text-editor][role=textbox]"));

const annotations = (index = 0): Annotation[] =>
  workspaceStore.getState().workspace?.pages[index].annotations ?? [];

function renderLayer() {
  const page = workspaceStore.getState().workspace?.pages[0];
  if (page === undefined) throw new Error("no page");
  const view = render(
    <AnnotationLayer page={page} transform={TRANSFORM} width={WIDTH} height={HEIGHT} />,
  );
  const rerender = () => {
    const next = workspaceStore.getState().workspace?.pages[0];
    if (next === undefined) throw new Error("no page");
    view.rerender(
      <AnnotationLayer page={next} transform={TRANSFORM} width={WIDTH} height={HEIGHT} />,
    );
  };
  const layer = view.container.querySelector("[data-testid=annotation-layer]");
  if (layer === null) throw new Error("no annotation layer");
  return { ...view, layer, rerender };
}

/** Both pages of the workspace, as the viewer mounts them: one layer each, one editor between them. */
function renderBothPages() {
  const pages = () => {
    const all = workspaceStore.getState().workspace?.pages;
    if (all === undefined) throw new Error("no pages");
    return all;
  };
  const layers = () => (
    <>
      {pages().map((page) => (
        <AnnotationLayer
          key={page.id}
          page={page}
          transform={TRANSFORM}
          width={WIDTH}
          height={HEIGHT}
        />
      ))}
    </>
  );
  const view = render(layers());
  const rerender = () => view.rerender(layers());
  const all = view.container.querySelectorAll("[data-testid=annotation-layer]");
  return { ...view, rerender, first: all[0], second: all[1] };
}

describe("AnnotationLayer", () => {
  it("moves the open text box to the page that was clicked last", () => {
    editorStore.setState({ tool: Tool.Text });
    const { first, second, rerender } = renderBothPages();

    fireEvent.pointerDown(first, { pointerId: 1, clientX: 60, clientY: 120 });
    rerender();
    expect(openBoxes()).toHaveLength(1);

    fireEvent.pointerDown(second, { pointerId: 1, clientX: 80, clientY: 140 });
    rerender();

    // One box, on page two, and page one is left with no phantom behind.
    const open = openBoxes();
    expect(open).toHaveLength(1);
    expect(annotations(0)).toEqual([]);
    expect(annotations(1)).toHaveLength(1);
    expect(editorStore.getState().editingAnnotation?.pageId).toBe(
      workspaceStore.getState().workspace?.pages[1].id,
    );
    expect(workspaceStore.getState().past).toEqual([]);

    // Page two still takes pointer events: close the box, then draw on it.
    fireEvent.keyDown(open[0], { key: "Escape" });
    rerender();
    expect(annotations(1)).toEqual([]);

    setTool(Tool.Rect);
    fireEvent.pointerDown(second, { pointerId: 2, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(second, { pointerId: 2, clientX: 120, clientY: 90 });
    fireEvent.pointerUp(second, { pointerId: 2, clientX: 120, clientY: 90 });
    expect(annotations(1)).toHaveLength(1);
    expect(annotations(1)[0].kind).toBe(AnnotationKind.Rect);
  });

  it("spends one history entry per text box when a second is opened from the first", () => {
    editorStore.setState({ tool: Tool.Text });
    const { first, second, rerender } = renderBothPages();

    fireEvent.pointerDown(first, { pointerId: 1, clientX: 60, clientY: 120 });
    rerender();
    const [boxA] = openBoxes();
    boxA.textContent = "alpha";

    // Opening B commits A where it stands, rather than folding the two together.
    setTool(Tool.Text);
    fireEvent.pointerDown(second, { pointerId: 1, clientX: 80, clientY: 140 });
    rerender();
    expect(annotations(0)[0]).toMatchObject({ content: "alpha" });
    expect(workspaceStore.getState().past).toHaveLength(1);

    const [boxB] = openBoxes();
    boxB.textContent = "beta";
    fireEvent.blur(boxB);
    rerender();

    expect(annotations(1)[0]).toMatchObject({ content: "beta" });
    expect(workspaceStore.getState().past).toHaveLength(2);

    workspaceStore.getState().undo();
    expect(annotations(1)).toEqual([]);
    expect(annotations(0)[0]).toMatchObject({ content: "alpha" });
    workspaceStore.getState().undo();
    expect(annotations(0)).toEqual([]);
  });

  it("draws shapes in PDF space inside a matrix-transformed group", () => {
    workspaceStore
      .getState()
      .addAnnotation(pageId(), createRect({ x: 30, y: 40, w: 120, h: 60 }, { strokeWidth: 3 }));

    const { layer } = renderLayer();

    const group = layer.querySelector(`g[transform="matrix(${TRANSFORM.join(",")})"]`);
    expect(group).not.toBeNull();
    const rect = group?.querySelector("rect");
    expect(rect?.getAttribute("x")).toBe("30");
    expect(rect?.getAttribute("y")).toBe("40");
    expect(rect?.getAttribute("width")).toBe("120");
    expect(rect?.getAttribute("height")).toBe("60");
    expect(rect?.getAttribute("stroke-width")).toBe("3");
  });

  it("adds an ink annotation with the drawn points when the pen is dragged", () => {
    editorStore.setState({ tool: Tool.Pen });
    const { layer } = renderLayer();

    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 20, clientY: 100, pressure: 0.4 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 40, clientY: 120, pressure: 0.6 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 60, clientY: 90, pressure: 0.8 });
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 60, clientY: 90 });

    const [ink] = annotations();
    expect(ink.kind).toBe(AnnotationKind.Ink);
    const strokes = (ink as InkAnnotation).strokes;
    expect(strokes).toHaveLength(1);
    expect(strokes[0].length).toBeGreaterThanOrEqual(2);
    // y is flipped: a pointer 100px down a 600pt page sits at y = 500.
    expect(strokes[0][0]).toMatchObject({ x: 20, y: 500 });
    expect(workspaceStore.getState().past).toHaveLength(1);
  });

  it("selects a shape when it is clicked with the select tool", () => {
    const rect = createRect({ x: 30, y: 40, w: 120, h: 60 });
    workspaceStore.getState().addAnnotation(pageId(), rect);
    const { layer } = renderLayer();

    const shape = layer.querySelector(`[data-annotation-id="${rect.id}"]`);
    expect(shape).not.toBeNull();
    fireEvent.pointerDown(shape as Element, { pointerId: 1, clientX: 60, clientY: 520 });

    expect(editorStore.getState().selectedAnnotation).toEqual({ pageId: pageId(), id: rect.id });
  });

  it("leaves no annotation and no history when a new text box is escaped", () => {
    editorStore.setState({ tool: Tool.Text });
    const historyBefore = workspaceStore.getState().past.length;
    const { layer, rerender } = renderLayer();

    fireEvent.pointerDown(layer, { pointerId: 1, clientX: 60, clientY: 120 });
    rerender();
    // The box exists to be typed into, but nothing has committed it yet.
    expect(annotations()).toHaveLength(1);
    expect(workspaceStore.getState().past).toHaveLength(historyBefore);

    fireEvent.keyDown(openBoxes()[0], { key: "Escape" });
    rerender();

    expect(annotations()).toEqual([]);
    expect(workspaceStore.getState().past).toHaveLength(historyBefore);
    expect(workspaceStore.getState().gestureBase).toBeNull();
    expect(editorStore.getState().selectedAnnotation).toBeNull();
  });

  it("removes a saved text box that is emptied, as one undoable step", () => {
    const text = createText({ x: 20, y: 40, w: 200, h: 20 }, { content: "draft" });
    workspaceStore.getState().addAnnotation(pageId(), text);
    const historyBefore = workspaceStore.getState().past.length;
    const { layer, rerender } = renderLayer();

    const shape = layer.querySelector(`[data-annotation-id="${text.id}"] rect`);
    fireEvent.pointerDown(shape as Element, { pointerId: 1, clientX: 60, clientY: 550 });
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 60, clientY: 550 });
    fireEvent.pointerDown(shape as Element, { pointerId: 1, clientX: 60, clientY: 550 });
    rerender();

    const [box] = openBoxes();
    box.textContent = "";
    fireEvent.blur(box);
    rerender();

    expect(annotations()).toEqual([]);
    expect(workspaceStore.getState().past).toHaveLength(historyBefore + 1);
    workspaceStore.getState().undo();
    expect(annotations()[0]).toEqual(text);
  });

  it("commits nothing when a drag ends on the geometry it started from", () => {
    const rect = createRect({ x: 30, y: 40, w: 120, h: 60 });
    workspaceStore.getState().addAnnotation(pageId(), rect);
    const historyBefore = workspaceStore.getState().past.length;
    const { layer } = renderLayer();

    const shape = layer.querySelector(`[data-annotation-id="${rect.id}"]`);
    fireEvent.pointerDown(shape as Element, { pointerId: 1, clientX: 60, clientY: 520 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 100, clientY: 480 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 60, clientY: 520 });
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 60, clientY: 520 });

    expect(annotations()[0]).toEqual(rect);
    expect(workspaceStore.getState().past).toHaveLength(historyBefore);
    expect(workspaceStore.getState().gestureBase).toBeNull();
  });

  it("drops a drag and records no history when Escape is pressed mid-move", () => {
    const rect = createRect({ x: 30, y: 40, w: 120, h: 60 });
    const id = pageId();
    workspaceStore.getState().addAnnotation(id, rect);
    const historyAfterAdd = workspaceStore.getState().past.length;
    const { layer, rerender } = renderLayer();

    const shape = layer.querySelector(`[data-annotation-id="${rect.id}"]`);
    fireEvent.pointerDown(shape as Element, { pointerId: 1, clientX: 60, clientY: 520 });
    fireEvent.pointerMove(layer, { pointerId: 1, clientX: 100, clientY: 480 });
    rerender();
    expect(annotations()[0]).toMatchObject({ rect: { x: 70, y: 80, w: 120, h: 60 } });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(annotations()[0]).toEqual(rect);
    expect(workspaceStore.getState().past).toHaveLength(historyAfterAdd);
    expect(workspaceStore.getState().gestureBase).toBeNull();

    // The cancelled gesture is over: a later pointer up must not commit anything.
    fireEvent.pointerUp(layer, { pointerId: 1, clientX: 100, clientY: 480 });
    expect(workspaceStore.getState().past).toHaveLength(historyAfterAdd);
  });
});
