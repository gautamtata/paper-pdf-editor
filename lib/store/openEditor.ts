/**
 * The one text box open for editing, and how to finish it. Pages each mount their own layer, so
 * opening a box on one page has to close the box on another before it touches the store — the
 * editor store holds *which* box is open, this holds the way to finish it where it lives.
 */
let open: { id: string; finish: () => void } | null = null;

export function registerOpenEditor(id: string, finish: () => void): () => void {
  open = { id, finish };
  return () => {
    if (open !== null && open.id === id) open = null;
  };
}

/** Commits or discards the open box through its own layer. A no-op when nothing is open. */
export function finishOpenEditor(): void {
  const current = open;
  open = null;
  current?.finish();
}
