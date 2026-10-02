"use client";

import { ArrowLeft, PanelBottom, PanelLeft, Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, useModKey } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";

interface EditorHeaderProps {
  name: string;
  pageCount: number;
  railOpen: boolean;
  onToggleRail: () => void;
  onOpenPalette: () => void;
  nameRef: RefObject<HTMLInputElement | null>;
}

export function EditorHeader({
  name,
  pageCount,
  railOpen,
  onToggleRail,
  onOpenPalette,
  nameRef,
}: EditorHeaderProps) {
  // `null` while the field is not being edited, so an external rename shows straight away.
  const [draft, setDraft] = useState<string | null>(null);
  const canUndo = useWorkspace((s) => s.past.length > 0);
  const canRedo = useWorkspace((s) => s.future.length > 0);
  const mod = useModKey();

  const commit = () => {
    const next = (draft ?? name).trim();
    if (next !== "" && next !== name) workspaceStore.getState().rename(next);
    setDraft(null);
  };

  return (
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/"
            aria-label="All documents"
            className="flex shrink-0 items-center gap-1.5 rounded-md py-1 pl-1 pr-2 text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="font-hand text-xl leading-none text-accent">Paper</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">All documents</TooltipContent>
      </Tooltip>

      <span aria-hidden className="h-5 w-px shrink-0 bg-border" />

      <Input
        ref={nameRef}
        name="workspace-name"
        aria-label="Document name"
        value={draft ?? name}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className="h-8 w-auto min-w-24 max-w-80 border-transparent bg-transparent px-1.5 font-medium shadow-none field-sizing-content hover:border-border hover:bg-surface-hover focus:border-border focus:bg-surface"
      />
      <span className="shrink-0 text-xs text-foreground-subtle tabular-nums">
        {pageCount} {pageCount === 1 ? "page" : "pages"}
      </span>

      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="mr-1 hidden gap-1.5 text-xs text-foreground-subtle sm:flex"
          onClick={onOpenPalette}
        >
          Find a command
          <Kbd>{mod}K</Kbd>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={() => workspaceStore.getState().undo()}
            >
              <Undo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Undo
            <Kbd className="border-transparent bg-white/15 text-paper-100 dark:bg-black/10 dark:text-paper-800">
              {mod}Z
            </Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={() => workspaceStore.getState().redo()}
            >
              <Redo2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Redo
            <Kbd className="border-transparent bg-white/15 text-paper-100 dark:bg-black/10 dark:text-paper-800">
              {mod}⇧Z
            </Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={railOpen ? "Hide pages" : "Show pages"}
              aria-pressed={railOpen}
              onClick={onToggleRail}
              className={cn(railOpen && "text-foreground")}
            >
              <PanelLeft className="size-4 max-[899px]:hidden" />
              <PanelBottom className="size-4 min-[900px]:hidden" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{railOpen ? "Hide pages" : "Show pages"}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
