"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useCallback, useState } from "react";
import { pageOrder, scrollToPage } from "@/components/editor/actions";
import { ThumbnailCard } from "@/components/editor/ThumbnailCard";
import { usePageOrder } from "@/components/editor/usePageOrder";
import { useRailDrop } from "@/components/editor/useRailDrop";
import { computeDropIndex } from "@/lib/pdf/reorder";
import type { PageId, VirtualPage } from "@/lib/pdf/types";
import { editorStore, useEditor, type SelectMode } from "@/lib/store/editor";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";

const NO_PAGES: VirtualPage[] = [];

// Module constants: `useSensor` memoises on its options object, and fresh ones each render would
// hand every card a new drag context and re-render it.
/** A few pixels of slop, so a click to select never reads as a drag. */
const MOUSE_ACTIVATION = { activationConstraint: { distance: 4 } };
/** A press-and-hold, so a swipe over the cards scrolls the rail instead of dragging a page. */
const TOUCH_ACTIVATION = { activationConstraint: { delay: 250, tolerance: 5 } };
const KEYBOARD_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };

/**
 * Moves focus to the neighbouring card. The row width comes from the cards sharing the first one's
 * top edge, so the arrows follow the grid however many columns it has.
 */
function focusNeighbour(grid: HTMLElement, key: string): boolean {
  const cards = [...grid.querySelectorAll<HTMLElement>("[data-page-card]")];
  const at = cards.findIndex((card) => card === document.activeElement);
  if (at === -1) return false;
  const perRow = Math.max(1, cards.filter((c) => c.offsetTop === cards[0].offsetTop).length);
  const step =
    key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : key === "ArrowDown" ? perRow : -perRow;
  cards[Math.min(Math.max(at + step, 0), cards.length - 1)]?.focus();
  return true;
}

const ARROWS = new Set(["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]);

export function ThumbnailRail({ className }: { className?: string }) {
  const pages = useWorkspace((s) => s.workspace?.pages) ?? NO_PAGES;
  const sources = useWorkspace((s) => s.workspace?.sources);
  const selectedPageIds = useEditor((s) => s.selectedPageIds);
  const activePageId = useEditor((s) => s.activePageId);
  const order = usePageOrder(pages);
  const { dropping, dropHandlers } = useRailDrop(order);
  const [focusedId, setFocusedId] = useState<PageId | null>(null);
  const [dragging, setDragging] = useState(false);

  const entryId = [focusedId, activePageId].find((id) => id !== null && order.includes(id));
  const tabStopId = entryId ?? order[0];

  const sensors = useSensors(
    useSensor(MouseSensor, MOUSE_ACTIVATION),
    useSensor(TouchSensor, TOUCH_ACTIVATION),
    useSensor(KeyboardSensor, KEYBOARD_OPTIONS),
  );

  const select = useCallback((id: PageId, mode: SelectMode) => {
    editorStore.getState().selectPage(id, mode, pageOrder());
    if (mode === "replace") scrollToPage(id);
  }, []);

  /** A drag of a selected card carries the whole selection; an unselected one carries itself. */
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false);
    if (over === null) return;
    const activeId = String(active.id);
    const selected = editorStore.getState().selectedPageIds;
    const moving = selected.has(activeId) ? order.filter((id) => selected.has(id)) : [activeId];
    if (!selected.has(activeId)) editorStore.getState().selectPage(activeId, "replace", order);
    const toIndex = computeDropIndex(order, moving, String(over.id));
    if (toIndex === null) return;
    workspaceStore.getState().movePages(moving, toIndex);
  };

  return (
    <div
      className={cn("flex min-h-0 flex-col border-border bg-surface-sunken", className)}
      {...dropHandlers}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => setDragging(true)}
            onDragCancel={() => setDragging(false)}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <ul
                role="listbox"
                aria-multiselectable
                aria-label="Pages"
                onFocus={(e) => setFocusedId(e.target.getAttribute("data-page-card"))}
                onKeyDown={(e) => {
                  // While dnd-kit is dragging, the arrows belong to it.
                  if (dragging || !ARROWS.has(e.key)) return;
                  if (focusNeighbour(e.currentTarget, e.key)) e.preventDefault();
                }}
                className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] justify-items-center gap-x-3 gap-y-3"
              >
                {pages.map((page, index) => (
                  <ThumbnailCard
                    key={page.id}
                    page={page}
                    index={index}
                    source={page.sourceId === null ? undefined : sources?.[page.sourceId]}
                    selected={selectedPageIds.has(page.id)}
                    active={activePageId === page.id}
                    tabStop={tabStopId === page.id}
                    selectionCount={selectedPageIds.size}
                    onSelect={select}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {pages.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-foreground-muted">
              Every page is gone. Undo, or add a PDF to start again.
            </p>
          ) : null}
        </div>

        {dropping ? (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent-soft/60 dark:bg-accent/15">
            <span className="rounded-sm bg-surface-raised px-2 py-1 text-xs font-medium text-foreground shadow-soft">
              Drop to add pages
            </span>
          </div>
        ) : null}
      </div>

      {selectedPageIds.size > 1 ? (
        <footer className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-foreground-muted">
          <span>{selectedPageIds.size} pages selected</span>
          <button
            type="button"
            className="rounded-xs px-1 py-0.5 font-medium text-accent transition-colors hover:bg-surface-hover"
            onClick={() => editorStore.getState().clearSelection()}
          >
            Clear
          </button>
        </footer>
      ) : null}
    </div>
  );
}
