import "fake-indexeddb/auto";

// jsdom ships no ResizeObserver, and Radix measures its thumbs/triggers with
// one. A no-op is enough: tests assert markup and behaviour, never geometry.
class NoopResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const env: { ResizeObserver?: unknown } = globalThis;
if (typeof window !== "undefined" && env.ResizeObserver === undefined) {
  env.ResizeObserver = NoopResizeObserver;
}
