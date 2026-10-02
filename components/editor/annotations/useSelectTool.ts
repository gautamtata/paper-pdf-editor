"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { handleRect, type Handle } from "@/components/editor/annotations/SelectionHandles";
import { clampRect } from "@/lib/annotations/geometry";
import {
  AnnotationKind,
  annotationBounds,
  resizeAnnotation,
  translateAnnotation,
  type Annotation,
  type InkPoint,
  type Rect,
} from "@/lib/annotations/types";
import type { PageId, PageSize } from "@/lib/pdf/types";
import { editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";

interface Point {
  x: number;
  y: number;
}

interface Options {
  pageId: PageId;
  pageSize: PageSize;
  toPdf(e: { clientX: number; clientY: number }): Point;
}

export interface SelectTool {
  dragging: boolean;
  shapeDown(a: Annotation, e: ReactPointerEvent<SVGElement>): void;
  handleDown(a: Annotation, h: Handle, e: ReactPointerEvent<SVGElement>): void;
  backgroundDown(): void;
  move(e: ReactPointerEvent<SVGElement>): void;
  up(): void;
  cancel(): void;
}

interface Drag {
  /** The annotation as it was when the drag began: every frame is derived from this, not the last. */
  base: Annotation;
  bounds: Rect;
  start: Point;
  handle: Handle | null;
  latest: Annotation | null;
}

const samePoints = (a: InkPoint[][], b: InkPoint[][]): boolean =>
  a.length === b.length &&
  a.every((stroke, i) => {
    const other = b[i];
    return (
      stroke.length === other.length &&
      stroke.every((p, j) => p.x === other[j].x && p.y === other[j].y)
    );
  });

/**
 * A drag can end exactly where it started: dragged back, absorbed by `clampRect`, or an image edge
 * whose height follows its width. Committing that would leave a no-op step in the history.
 */
const sameGeometry = (base: Annotation, latest: Annotation): boolean =>
  base.kind === AnnotationKind.Ink || latest.kind === AnnotationKind.Ink
    ? base.kind === AnnotationKind.Ink &&
      latest.kind === AnnotationKind.Ink &&
      samePoints(base.strokes, latest.strokes)
    : base.rect.x === latest.rect.x &&
      base.rect.y === latest.rect.y &&
      base.rect.w === latest.rect.w &&
      base.rect.h === latest.rect.h;

/** Only geometry moves, so a commit patches exactly what the drag changed. */
const geometryPatch = (a: Annotation): Partial<Annotation> =>
  a.kind === AnnotationKind.Ink ? { strokes: a.strokes } : { rect: a.rect };

const movedInside = (base: Annotation, dx: number, dy: number, page: PageSize): Annotation => {
  const next = translateAnnotation(base, dx, dy);
  const bounds = annotationBounds(next);
  const inside = clampRect(bounds, page);
  return translateAnnotation(next, inside.x - bounds.x, inside.y - bounds.y);
};

/** Moving and resizing the selected annotation, as one history entry per gesture. */
export function useSelectTool({ pageId, pageSize, toPdf }: Options): SelectTool {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);

  const begin = useCallback(
    (a: Annotation, handle: Handle | null, e: ReactPointerEvent<SVGElement>) => {
      e.stopPropagation();
      // The shape owns the gesture: no focus reset, no native drag, no text selection under it.
      e.preventDefault();
      editorStore.getState().setSelectedAnnotation({ pageId, id: a.id });
      drag.current = {
        base: a,
        bounds: annotationBounds(a),
        start: toPdf(e),
        handle,
        latest: null,
      };
      setDragging(true);
    },
    [pageId, toPdf],
  );

  const shapeDown = useCallback(
    (a: Annotation, e: ReactPointerEvent<SVGElement>) => begin(a, null, e),
    [begin],
  );

  const handleDown = useCallback(
    (a: Annotation, h: Handle, e: ReactPointerEvent<SVGElement>) => begin(a, h, e),
    [begin],
  );

  const backgroundDown = useCallback(() => {
    editorStore.getState().setSelectedAnnotation(null);
  }, []);

  const move = useCallback(
    (e: ReactPointerEvent<SVGElement>) => {
      const d = drag.current;
      if (d === null) return;
      const at = toPdf(e);
      const dx = at.x - d.start.x;
      const dy = at.y - d.start.y;
      if (dx === 0 && dy === 0 && d.latest === null) return;
      const next =
        d.handle === null
          ? movedInside(d.base, dx, dy, pageSize)
          : resizeAnnotation(d.base, clampRect(handleRect(d.bounds, d.handle, dx, dy), pageSize));
      d.latest = next;
      workspaceStore
        .getState()
        .updateAnnotation(pageId, d.base.id, geometryPatch(next), { transient: true });
    },
    [pageId, pageSize, toPdf],
  );

  const up = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d === null || d.latest === null) return;
    if (sameGeometry(d.base, d.latest)) {
      workspaceStore.getState().cancelGesture();
      return;
    }
    workspaceStore.getState().updateAnnotation(pageId, d.base.id, geometryPatch(d.latest));
  }, [pageId]);

  const cancel = useCallback(() => {
    if (drag.current === null) return;
    drag.current = null;
    setDragging(false);
    workspaceStore.getState().cancelGesture();
  }, []);

  return { dragging, shapeDown, handleDown, backgroundDown, move, up, cancel };
}
