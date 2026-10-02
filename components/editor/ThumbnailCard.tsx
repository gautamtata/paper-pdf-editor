"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  FileOutput,
  MoreVertical,
  RotateCcw,
  RotateCw,
  SquarePlus,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  deleteSelected,
  duplicateSelected,
  extractSelected,
  insertBlankAfter,
  rotateSelected,
} from "@/components/editor/actions";
import { pageBox, totalRotation } from "@/components/editor/geometry";
import { useInView } from "@/components/editor/useInView";
import { usePageCanvas } from "@/components/editor/usePageCanvas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Rotation, type PageId, type SourceDoc, type VirtualPage } from "@/lib/pdf/types";
import type { SelectMode } from "@/lib/store/editor";
import { cn, dpr } from "@/lib/utils";

const THUMB_WIDTH = 120;

interface Modifiers {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

const modeFor = (e: Modifiers): SelectMode =>
  e.shiftKey ? "range" : e.metaKey || e.ctrlKey ? "toggle" : "replace";

interface ThumbnailCardProps {
  page: VirtualPage;
  index: number;
  source: SourceDoc | undefined;
  selected: boolean;
  active: boolean;
  selectionCount: number;
  onSelect: (id: PageId, mode: SelectMode) => void;
}

export function ThumbnailCard({
  page,
  index,
  source,
  selected,
  active,
  selectionCount,
  onSelect,
}: ThumbnailCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, "300px");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  const natural = pageBox(page, source, 1);
  const scale = THUMB_WIDTH / natural.width;
  const { canvasRef, painted } = usePageCanvas({
    source,
    pageIndex: page.sourceIndex,
    rotation: totalRotation(page, source),
    scale: scale * dpr(),
    enabled: inView,
  });

  // The menu acts on the selection, so a card acted on out of band joins it first.
  const onSelection = (run: () => void) => () => {
    if (!selected) onSelect(page.id, "replace");
    run();
  };
  const scope = selected && selectionCount > 1 ? ` ${selectionCount} pages` : "";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="option"
      tabIndex={0}
      aria-label={`Page ${index + 1}`}
      aria-selected={selected}
      data-testid="thumbnail"
      data-page-card={page.id}
      className={cn(
        "group relative w-full max-w-[120px] touch-none list-none rounded-sm outline-none",
        isDragging && "z-10 opacity-40",
      )}
      onClick={(e) => onSelect(page.id, modeFor(e))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(page.id, modeFor(e));
          return;
        }
        // Space hands the card to dnd-kit; while it is dragging, dnd-kit listens on the
        // document itself, and forwarding again would restart the drag.
        if (!isDragging) listeners?.onKeyDown?.(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!selected) onSelect(page.id, "replace");
        setMenuOpen(true);
      }}
    >
      <div
        ref={frameRef}
        style={{ aspectRatio: natural.width / natural.height }}
        className={cn(
          "relative w-full overflow-hidden rounded-sm bg-white shadow-page transition-[box-shadow,outline-color]",
          "outline-2 outline-offset-2 outline-transparent",
          selected && "outline-accent",
          !selected && "group-hover:outline-border-strong group-focus-visible:outline-accent",
        )}
      >
        {page.sourceId === null ? (
          <span className="flex h-full items-center justify-center text-[0.625rem] text-paper-400">
            Blank
          </span>
        ) : (
          <canvas
            ref={canvasRef}
            className={cn("block h-full w-full transition-opacity", painted ? "opacity-100" : "opacity-0")}
          />
        )}

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for page ${index + 1}`}
              className={cn(
                "absolute right-1 top-1 size-6 rounded-xs bg-surface-raised/90 text-foreground-muted shadow-soft",
                "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onSelection(() => rotateSelected(Rotation.R270))}>
              <RotateCcw />
              Rotate left
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSelection(() => rotateSelected(Rotation.R90))}>
              <RotateCw />
              Rotate right
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSelection(duplicateSelected)}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertBlankAfter(page.id)}>
              <SquarePlus />
              Insert blank page after
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSelection(() => void extractSelected())}>
              <FileOutput />
              Extract{scope} to new document
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onSelection(deleteSelected)}>
              <Trash2 />
              Delete{scope}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <span
        className={cn(
          "mt-1.5 block text-center text-[0.6875rem] tabular-nums transition-colors",
          selected ? "font-medium text-accent" : "text-foreground-subtle",
          active && !selected && "text-foreground",
        )}
      >
        {index + 1}
      </span>
    </li>
  );
}
