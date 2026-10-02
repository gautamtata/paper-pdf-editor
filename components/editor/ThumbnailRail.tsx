"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
import { useMemo } from "react";
import { scrollToPage } from "@/components/editor/actions";
import { ThumbnailCard } from "@/components/editor/ThumbnailCard";
import { useRailDrop } from "@/components/editor/useRailDrop";
import { computeDropIndex } from "@/lib/pdf/reorder";
import type { PageId, VirtualPage } from "@/lib/pdf/types";
import { editorStore, useEditor, type SelectMode } from "@/lib/store/editor";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";

const NO_PAGES: VirtualPage[] = [];

export function ThumbnailRail({ className }: { className?: string }) {
  const pages = useWorkspace((s) => s.workspace?.pages) ?? NO_PAGES;
  const sources = useWorkspace((s) => s.workspace?.sources);
  const selectedPageIds = useEditor((s) => s.selectedPageIds);
  const activePageId = useEditor((s) => s.activePageId);
  const order = useMemo(() => pages.map((page) => page.id), [pages]);
  const { dropping, dropHandlers } = useRailDrop(order);

  const sensors = useSensors(
    // A few pixels of slop, so a click to select never reads as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const select = (id: PageId, mode: SelectMode) => {
    editorStore.getState().selectPage(id, mode, order);
    if (mode === "replace") scrollToPage(id);
  };

  /** A drag of a selected card carries the whole selection; an unselected one carries itself. */
  const onDragEnd = ({ active, over }: DragEndEvent) => {
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={rectSortingStrategy}>
              <ul
                role="listbox"
                aria-multiselectable
                aria-label="Pages"
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
