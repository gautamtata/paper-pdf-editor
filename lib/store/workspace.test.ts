import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnotationKind, createHighlight, createText } from "@/lib/annotations/types";
import {
  Rotation,
  type PageId,
  type SourceDoc,
  type VirtualPage,
  type Workspace,
} from "@/lib/pdf/types";
import { selectPage, startAutosave, workspaceStore } from "@/lib/store/workspace";

const srcDoc = (id: string, pageCount: number): SourceDoc => ({
  id,
  name: `${id}.pdf`,
  bytes: new Uint8Array([1, 2, 3]),
  pageCount,
  pages: Array.from({ length: pageCount }, () => ({
    size: { w: 400, h: 600 },
    origin: { x: 0, y: 0 },
    rotation: Rotation.R0,
  })),
});

const ids = (pages: VirtualPage[]): PageId[] => pages.map((p) => p.id);

const ws = (): Workspace => {
  const workspace = workspaceStore.getState().workspace;
  if (workspace === null) throw new Error("no workspace");
  return workspace;
};

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

beforeEach(() => {
  workspaceStore.setState({
    workspace: null,
    past: [],
    future: [],
    gestureBase: null,
    gestureOwner: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("create", () => {
  it("builds one page per source page across all sources and returns the workspace", () => {
    const created = workspaceStore.getState().create("Deck", [srcDoc("a", 6), srcDoc("b", 4)]);

    expect(created.pages).toHaveLength(10);
    expect(created.name).toBe("Deck");
    expect(Object.keys(created.sources).sort()).toEqual(["a", "b"]);
    expect(created.pages.slice(0, 6).every((p) => p.sourceId === "a")).toBe(true);
    expect(created.pages.slice(6).every((p) => p.sourceId === "b")).toBe(true);
    expect(created.pages.map((p) => p.sourceIndex)).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 2, 3]);
    expect(ws()).toBe(created);
  });

  it("clears history", () => {
    workspaceStore.getState().create("One", [srcDoc("a", 2)]);
    workspaceStore.getState().deletePages([ws().pages[0].id]);
    workspaceStore.getState().create("Two", [srcDoc("b", 2)]);

    expect(workspaceStore.getState().past).toEqual([]);
    expect(workspaceStore.getState().future).toEqual([]);
    expect(workspaceStore.getState().canUndo()).toBe(false);
  });
});

describe("load", () => {
  it("replaces the workspace and clears history", () => {
    workspaceStore.getState().create("One", [srcDoc("a", 3)]);
    workspaceStore.getState().deletePages([ws().pages[0].id]);
    const loaded: Workspace = {
      id: "other",
      name: "Other",
      sources: {},
      pages: [],
      updatedAt: 5,
    };

    workspaceStore.getState().load(loaded);

    expect(ws()).toBe(loaded);
    expect(workspaceStore.getState().past).toEqual([]);
    expect(workspaceStore.getState().future).toEqual([]);
  });
});

describe("undo / redo", () => {
  it("restores the pages a delete removed, then reapplies them on redo", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 4)]);
    const before = ids(ws().pages);
    workspaceStore.getState().deletePages([before[1], before[2]]);
    const afterDelete = ids(ws().pages);
    expect(afterDelete).toEqual([before[0], before[3]]);
    expect(workspaceStore.getState().canUndo()).toBe(true);

    workspaceStore.getState().undo();
    expect(ids(ws().pages)).toEqual(before);
    expect(workspaceStore.getState().canUndo()).toBe(false);
    expect(workspaceStore.getState().canRedo()).toBe(true);

    workspaceStore.getState().redo();
    expect(ids(ws().pages)).toEqual(afterDelete);
    expect(workspaceStore.getState().canRedo()).toBe(false);
    expect(workspaceStore.getState().canUndo()).toBe(true);
  });

  it("drops the redo stack once a new action is taken after an undo", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 3)]);
    const page = ws().pages[0].id;
    workspaceStore.getState().deletePages([page]);
    workspaceStore.getState().undo();
    expect(workspaceStore.getState().canRedo()).toBe(true);

    workspaceStore.getState().rotatePages([page], Rotation.R90);

    expect(workspaceStore.getState().future).toEqual([]);
    expect(workspaceStore.getState().canRedo()).toBe(false);
  });

  it("is a no-op with nothing to undo or redo", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);
    const pages = ws().pages;

    workspaceStore.getState().undo();
    workspaceStore.getState().redo();

    expect(ws().pages).toBe(pages);
  });

  it("caps the past at 100 snapshots", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 1)]);
    const page = ws().pages[0].id;

    for (let i = 0; i < 120; i += 1) {
      workspaceStore.getState().rotatePages([page], Rotation.R90);
    }

    expect(workspaceStore.getState().past).toHaveLength(100);
  });

  it("never mutates a snapshot it is holding", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);
    const original = ws().pages;
    const page = original[0].id;

    workspaceStore.getState().rotatePages([page], Rotation.R180);
    workspaceStore.getState().addAnnotation(page, createText({ x: 0, y: 0, w: 10, h: 10 }));

    expect(original[0].rotation).toBe(Rotation.R0);
    expect(original[0].annotations).toEqual([]);
    expect(workspaceStore.getState().past[0]).toBe(original);
  });
});

describe("page operations", () => {
  const setup = (pageCount = 4): PageId[] => {
    workspaceStore.getState().create("Deck", [srcDoc("a", pageCount)]);
    workspaceStore.setState({ workspace: { ...ws(), updatedAt: 0 } });
    return ids(ws().pages);
  };

  it("moves pages and bumps updatedAt", () => {
    const [p0, p1, p2, p3] = setup();

    workspaceStore.getState().movePages([p3], 0);

    expect(ids(ws().pages)).toEqual([p3, p0, p1, p2]);
    expect(ws().updatedAt).toBeGreaterThan(0);
    expect(workspaceStore.getState().past).toHaveLength(1);
  });

  it("rotates only the selected pages", () => {
    const [p0, p1] = setup(2);

    workspaceStore.getState().rotatePages([p1], Rotation.R90);

    const pages = ws().pages;
    expect(pages.find((p) => p.id === p0)?.rotation).toBe(Rotation.R0);
    expect(pages.find((p) => p.id === p1)?.rotation).toBe(Rotation.R90);
  });

  it("duplicates a page in place with a fresh id", () => {
    const [p0, p1] = setup(2);

    workspaceStore.getState().duplicatePages([p0]);

    const pages = ws().pages;
    expect(pages).toHaveLength(3);
    expect(pages[0].id).toBe(p0);
    expect(pages[1].id).not.toBe(p0);
    expect(pages[1].sourceIndex).toBe(0);
    expect(pages[2].id).toBe(p1);
  });

  it("inserts a blank page at the given index", () => {
    const [p0, p1] = setup(2);

    workspaceStore.getState().insertBlank(1, { w: 200, h: 300 });

    const pages = ws().pages;
    expect(ids(pages)).toEqual([p0, pages[1].id, p1]);
    expect(pages[1].sourceId).toBeNull();
    expect(pages[1].size).toEqual({ w: 200, h: 300 });
  });

  it("allows deleting every page", () => {
    const all = setup(3);

    workspaceStore.getState().deletePages(all);

    expect(ws().pages).toEqual([]);
    expect(workspaceStore.getState().canUndo()).toBe(true);
  });

  it("does nothing without a workspace", () => {
    workspaceStore.getState().deletePages(["nope"]);

    expect(workspaceStore.getState().workspace).toBeNull();
    expect(workspaceStore.getState().past).toEqual([]);
  });
});

describe("addSources", () => {
  it("registers each source and appends its pages", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);

    workspaceStore.getState().addSources([srcDoc("b", 2), srcDoc("c", 1)]);

    expect(Object.keys(ws().sources).sort()).toEqual(["a", "b", "c"]);
    expect(ws().pages.map((p) => p.sourceId)).toEqual(["a", "a", "b", "b", "c"]);
    expect(workspaceStore.getState().past).toHaveLength(1);
  });

  it("records no history for an empty list", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);
    const before = ws();

    workspaceStore.getState().addSources([]);

    expect(ws()).toBe(before);
    expect(workspaceStore.getState().past).toEqual([]);
  });

  it("inserts each source after the previous one's pages at atIndex", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);

    workspaceStore.getState().addSources([srcDoc("b", 2), srcDoc("c", 1)], 1);

    expect(ws().pages.map((p) => p.sourceId)).toEqual(["a", "b", "b", "c", "a"]);
  });
});

describe("annotations", () => {
  const withPage = (): PageId => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);
    return ws().pages[0].id;
  };

  const annotationsOf = (pageId: PageId) =>
    ws().pages.find((p) => p.id === pageId)?.annotations ?? [];

  it("adds, updates and removes an annotation, each undoable", () => {
    const pageId = withPage();
    const text = createText({ x: 1, y: 2, w: 30, h: 40 }, { content: "hi" });

    workspaceStore.getState().addAnnotation(pageId, text);
    expect(annotationsOf(pageId)).toEqual([text]);

    workspaceStore.getState().updateAnnotation(pageId, text.id, { content: "bye" });
    const updated = annotationsOf(pageId)[0];
    expect(updated).toMatchObject({ id: text.id, kind: AnnotationKind.Text, content: "bye" });

    workspaceStore.getState().removeAnnotation(pageId, text.id);
    expect(annotationsOf(pageId)).toEqual([]);

    workspaceStore.getState().undo();
    expect(annotationsOf(pageId)).toHaveLength(1);
    workspaceStore.getState().undo();
    expect(annotationsOf(pageId)[0]).toEqual(text);
    workspaceStore.getState().undo();
    expect(annotationsOf(pageId)).toEqual([]);
  });

  it("leaves other pages untouched", () => {
    const pageId = withPage();
    const other = ws().pages[1];

    workspaceStore.getState().addAnnotation(pageId, createHighlight({ x: 0, y: 0, w: 5, h: 5 }));

    expect(ws().pages[1]).toBe(other);
  });

  it("ignores kind and id in the patch", () => {
    const pageId = withPage();
    const text = createText({ x: 0, y: 0, w: 10, h: 10 });
    workspaceStore.getState().addAnnotation(pageId, text);

    workspaceStore
      .getState()
      .updateAnnotation(pageId, text.id, { id: "hijacked", kind: AnnotationKind.Rect });

    expect(annotationsOf(pageId)[0]).toMatchObject({ id: text.id, kind: AnnotationKind.Text });
  });

  it("records no history for an add or remove that hits nothing", () => {
    const pageId = withPage();
    const before = ws();

    workspaceStore.getState().addAnnotation("nope", createText({ x: 0, y: 0, w: 1, h: 1 }));
    workspaceStore.getState().removeAnnotation(pageId, "nope");

    expect(ws()).toBe(before);
    expect(workspaceStore.getState().past).toEqual([]);
  });

  it("ignores updates for unknown pages or annotations", () => {
    const pageId = withPage();
    const text = createText({ x: 0, y: 0, w: 10, h: 10 });
    workspaceStore.getState().addAnnotation(pageId, text);
    const pages = ws().pages;

    workspaceStore.getState().updateAnnotation("nope", text.id, { content: "x" });
    workspaceStore.getState().updateAnnotation(pageId, "nope", { content: "x" });

    expect(annotationsOf(pageId)[0]).toEqual(text);
    expect(ws().pages).toBe(pages);
  });

  it("records one history entry for a whole transient gesture", () => {
    const pageId = withPage();
    const text = createText({ x: 0, y: 0, w: 10, h: 10 });
    workspaceStore.getState().addAnnotation(pageId, text);
    const historyAfterAdd = workspaceStore.getState().past.length;

    const move = (x: number, transient: boolean) =>
      workspaceStore
        .getState()
        .updateAnnotation(
          pageId,
          text.id,
          { rect: { x, y: 0, w: 10, h: 10 } },
          transient ? { transient: true } : undefined,
        );

    move(5, true);
    move(10, true);
    move(15, true);
    expect(workspaceStore.getState().past).toHaveLength(historyAfterAdd);
    expect(annotationsOf(pageId)[0]).toMatchObject({ rect: { x: 15, y: 0, w: 10, h: 10 } });

    move(20, false);
    expect(workspaceStore.getState().past).toHaveLength(historyAfterAdd + 1);

    workspaceStore.getState().undo();
    expect(annotationsOf(pageId)[0]).toEqual(text);
  });

  it("keeps the redo stack during a transient gesture", () => {
    const pageId = withPage();
    const text = createText({ x: 0, y: 0, w: 10, h: 10 });
    workspaceStore.getState().addAnnotation(pageId, text);
    workspaceStore.getState().rotatePages([pageId], Rotation.R90);
    workspaceStore.getState().undo();
    expect(annotationsOf(pageId)).toHaveLength(1);
    expect(workspaceStore.getState().canRedo()).toBe(true);

    workspaceStore
      .getState()
      .updateAnnotation(pageId, text.id, { content: "x" }, { transient: true });

    expect(annotationsOf(pageId)[0]).toMatchObject({ content: "x" });
    expect(workspaceStore.getState().canRedo()).toBe(true);
  });

  it("keeps a transient add out of history until something commits it", () => {
    const pageId = withPage();
    const text = createText({ x: 0, y: 0, w: 10, h: 10 });
    const pagesBeforeAdd = ws().pages;

    workspaceStore.getState().addAnnotation(pageId, text, { transient: true });

    expect(annotationsOf(pageId)).toHaveLength(1);
    expect(workspaceStore.getState().past).toEqual([]);
    expect(workspaceStore.getState().gestureBase).toBe(pagesBeforeAdd);

    workspaceStore.getState().updateAnnotation(pageId, text.id, { content: "hello" });

    expect(annotationsOf(pageId)[0]).toMatchObject({ content: "hello" });
    expect(workspaceStore.getState().past).toHaveLength(1);
    expect(workspaceStore.getState().gestureBase).toBeNull();

    workspaceStore.getState().undo();
    expect(annotationsOf(pageId)).toEqual([]);
  });

  it("drops a transient add entirely when the gesture is cancelled", () => {
    const pageId = withPage();
    const pagesBeforeAdd = ws().pages;

    workspaceStore
      .getState()
      .addAnnotation(pageId, createText({ x: 0, y: 0, w: 10, h: 10 }), { transient: true });
    workspaceStore.getState().cancelGesture();

    expect(ws().pages).toBe(pagesBeforeAdd);
    expect(annotationsOf(pageId)).toEqual([]);
    expect(workspaceStore.getState().past).toEqual([]);
    expect(workspaceStore.getState().gestureBase).toBeNull();
  });

  it("abandons a half-made annotation when another kind of edit commits", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);
    const [p0, p1] = ids(ws().pages);
    workspaceStore
      .getState()
      .addAnnotation(p0, createText({ x: 0, y: 0, w: 10, h: 10 }), { transient: true });

    workspaceStore.getState().deletePages([p1]);

    expect(annotationsOf(p0)).toEqual([]);
    expect(ids(ws().pages)).toEqual([p0]);
    expect(workspaceStore.getState().gestureBase).toBeNull();

    workspaceStore.getState().undo();
    expect(ids(ws().pages)).toEqual([p0, p1]);
    expect(annotationsOf(p0)).toEqual([]);
  });

  describe("cancelGesture", () => {
    it("restores the pages the gesture started from without recording history", () => {
      const pageId = withPage();
      const text = createText({ x: 0, y: 0, w: 10, h: 10 });
      workspaceStore.getState().addAnnotation(pageId, text);
      const historyAfterAdd = workspaceStore.getState().past.length;
      const pagesAfterAdd = ws().pages;

      workspaceStore
        .getState()
        .updateAnnotation(pageId, text.id, { rect: { x: 7, y: 0, w: 10, h: 10 } }, {
          transient: true,
        });
      expect(workspaceStore.getState().gestureBase).toBe(pagesAfterAdd);

      workspaceStore.getState().cancelGesture();

      expect(ws().pages).toBe(pagesAfterAdd);
      expect(annotationsOf(pageId)[0]).toEqual(text);
      expect(workspaceStore.getState().past).toHaveLength(historyAfterAdd);
      expect(workspaceStore.getState().gestureBase).toBeNull();
    });

    it("refuses to cancel a gesture another annotation owns", () => {
      const pageId = withPage();
      const text = createText({ x: 0, y: 0, w: 10, h: 10 });
      workspaceStore.getState().addAnnotation(pageId, text, { transient: true });

      workspaceStore.getState().cancelGesture({ pageId, id: "someone-else" });
      expect(annotationsOf(pageId)).toHaveLength(1);
      expect(workspaceStore.getState().gestureBase).not.toBeNull();

      workspaceStore.getState().cancelGesture({ pageId: "other-page", id: text.id });
      expect(annotationsOf(pageId)).toHaveLength(1);

      workspaceStore.getState().cancelGesture({ pageId, id: text.id });
      expect(annotationsOf(pageId)).toEqual([]);
      expect(workspaceStore.getState().gestureBase).toBeNull();
      expect(workspaceStore.getState().gestureOwner).toBeNull();
    });

    it("is a no-op when no gesture is in flight", () => {
      const pageId = withPage();
      workspaceStore.getState().addAnnotation(pageId, createText({ x: 0, y: 0, w: 10, h: 10 }));
      const before = ws();
      const { past, future } = workspaceStore.getState();

      workspaceStore.getState().cancelGesture();

      expect(ws()).toBe(before);
      expect(workspaceStore.getState().past).toBe(past);
      expect(workspaceStore.getState().future).toBe(future);
    });
  });
});

describe("rename", () => {
  it("changes the name and bumps updatedAt without touching history", () => {
    workspaceStore.getState().create("Old", [srcDoc("a", 1)]);
    workspaceStore.setState({ workspace: { ...ws(), updatedAt: 0 } });

    workspaceStore.getState().rename("New");

    expect(ws().name).toBe("New");
    expect(ws().updatedAt).toBeGreaterThan(0);
    expect(workspaceStore.getState().past).toEqual([]);
  });
});

describe("extractToWorkspace", () => {
  it("returns a new workspace with only the used sources and leaves the original alone", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2), srcDoc("b", 2)]);
    const before = ws();
    const bPage = before.pages[2];

    const extracted = workspaceStore.getState().extractToWorkspace([bPage.id], "Slice");

    expect(extracted.name).toBe("Slice");
    expect(extracted.id).not.toBe(before.id);
    expect(extracted.pages).toHaveLength(1);
    expect(extracted.pages[0].id).not.toBe(bPage.id);
    expect(extracted.pages[0].sourceId).toBe("b");
    expect(Object.keys(extracted.sources)).toEqual(["b"]);
    expect(extracted.sources.b).toBe(before.sources.b);
    expect(ws()).toBe(before);
    expect(workspaceStore.getState().past).toEqual([]);
  });

  it("drops sources only blank pages would need", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 1)]);
    workspaceStore.getState().insertBlank(1, { w: 10, h: 10 });
    const blank = ws().pages[1].id;

    const extracted = workspaceStore.getState().extractToWorkspace([blank], "Blank");

    expect(extracted.sources).toEqual({});
  });
});

describe("selectPage selector", () => {
  it("finds the page by id and returns undefined otherwise", () => {
    workspaceStore.getState().create("Deck", [srcDoc("a", 2)]);
    const page = ws().pages[1];

    expect(selectPage(page.id)(workspaceStore.getState())).toBe(page);
    expect(selectPage("nope")(workspaceStore.getState())).toBeUndefined();
  });
});

describe("startAutosave", () => {
  const loaded = (): Workspace => {
    const workspace: Workspace = {
      id: "w1",
      name: "Deck",
      sources: {},
      pages: [],
      updatedAt: 1,
    };
    workspaceStore.getState().load(workspace);
    return workspace;
  };

  it("collapses rapid edits into a single save of the latest workspace", async () => {
    vi.useFakeTimers();
    const save = vi.fn<(w: Workspace) => Promise<void>>().mockResolvedValue(undefined);
    const stop = startAutosave(save);
    loaded();

    workspaceStore.getState().rename("a");
    vi.advanceTimersByTime(100);
    workspaceStore.getState().rename("b");
    vi.advanceTimersByTime(100);
    workspaceStore.getState().rename("c");
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].name).toBe("c");
    stop();
  });

  it("does not save when a workspace is merely loaded", async () => {
    vi.useFakeTimers();
    const save = vi.fn<(w: Workspace) => Promise<void>>().mockResolvedValue(undefined);
    const stop = startAutosave(save);

    loaded();
    workspaceStore.getState().create("Fresh", [srcDoc("a", 1)]);
    await vi.advanceTimersByTimeAsync(500);

    expect(save).not.toHaveBeenCalled();
    stop();
  });

  it("waits for an in-flight save, then saves the latest once", async () => {
    vi.useFakeTimers();
    const first = deferred();
    const save = vi
      .fn<(w: Workspace) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    const stop = startAutosave(save);
    loaded();

    workspaceStore.getState().rename("a");
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);

    workspaceStore.getState().rename("b");
    workspaceStore.getState().rename("c");
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].name).toBe("c");
    stop();
  });

  it("logs and survives a rejected save", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const save = vi
      .fn<(w: Workspace) => Promise<void>>()
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValue(undefined);
    const stop = startAutosave(save);
    loaded();

    workspaceStore.getState().rename("a");
    await vi.advanceTimersByTimeAsync(500);
    expect(error).toHaveBeenCalled();

    workspaceStore.getState().rename("b");
    await vi.advanceTimersByTimeAsync(500);

    expect(save).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops saving and cancels a pending save once disposed", async () => {
    vi.useFakeTimers();
    const save = vi.fn<(w: Workspace) => Promise<void>>().mockResolvedValue(undefined);
    const stop = startAutosave(save);
    loaded();

    workspaceStore.getState().rename("a");
    stop();
    await vi.advanceTimersByTimeAsync(500);
    workspaceStore.getState().rename("b");
    await vi.advanceTimersByTimeAsync(500);

    expect(save).not.toHaveBeenCalled();
  });
});
