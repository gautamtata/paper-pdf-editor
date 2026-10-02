import "fake-indexeddb/auto";

// jsdom ships no ResizeObserver, and Radix measures its thumbs/triggers with
// one. A no-op is enough: tests assert markup and behaviour, never geometry.
class NoopResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * jsdom ships no IntersectionObserver either, and the editor renders pages lazily behind one.
 * This reports every observed element as fully visible, so tests see the loaded state.
 */
class VisibleIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    const entry: IntersectionObserverEntry = {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      intersectionRect: rect,
      boundingClientRect: rect,
      rootBounds: null,
      time: 0,
    };
    this.callback([entry], this);
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const env: { ResizeObserver?: unknown; IntersectionObserver?: unknown } = globalThis;
if (typeof window !== "undefined" && env.ResizeObserver === undefined) {
  env.ResizeObserver = NoopResizeObserver;
}
if (typeof window !== "undefined" && env.IntersectionObserver === undefined) {
  env.IntersectionObserver = VisibleIntersectionObserver;
}

// jsdom has no 2d backend and logs a "not implemented" error per call. Components treat a
// missing context as "cannot paint", which is exactly the jsdom situation.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}
