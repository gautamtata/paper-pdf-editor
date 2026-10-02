"use client";

import { Check, Minus, Plus } from "lucide-react";
import { zoomIn, zoomOut, zoomTo } from "@/components/editor/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { editorStore, useEditor, type ZoomMode } from "@/lib/store/editor";
import { cn } from "@/lib/utils";

const PRESETS = [0.5, 1, 1.5, 2];

function Row({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <PopoverClose asChild>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover",
          checked && "font-medium",
        )}
      >
        <Check
          className={cn("size-3.5 text-accent", checked ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
        {children}
      </button>
    </PopoverClose>
  );
}

export function ZoomMenu({ displayScale }: { displayScale: number }) {
  const zoomMode = useEditor((s) => s.zoomMode);
  const percent = Math.round(displayScale * 100);
  const setMode = (mode: ZoomMode) => editorStore.getState().setZoomMode(mode);

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Zoom out"
        className="size-8 rounded-full max-[560px]:hidden"
        onClick={() => zoomOut(displayScale)}
      >
        <Minus className="size-3.5" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-w-15 rounded-full px-2 text-foreground tabular-nums"
          >
            {percent}%
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" side="top" className="w-40 p-1">
          <Row checked={zoomMode === "fit-width"} onSelect={() => setMode("fit-width")}>
            Fit width
          </Row>
          <Row checked={zoomMode === "fit-page"} onSelect={() => setMode("fit-page")}>
            Fit page
          </Row>
          <div className="my-1 h-px bg-border" />
          {PRESETS.map((preset) => (
            <Row
              key={preset}
              checked={zoomMode === "custom" && percent === preset * 100}
              onSelect={() => zoomTo(preset)}
            >
              {preset * 100}%
            </Row>
          ))}
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Zoom in"
        className="size-8 rounded-full max-[560px]:hidden"
        onClick={() => zoomIn(displayScale)}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
