"use client";

import { Command } from "cmdk";
import {
  ArrowRight,
  Copy,
  Download,
  FileOutput,
  FilePlus2,
  Maximize2,
  PenLine,
  Redo2,
  RotateCcw,
  RotateCw,
  SquarePlus,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  deleteSelected,
  duplicateSelected,
  extractSelected,
  insertBlankAfter,
  rotateSelected,
  scrollToPage,
  zoomTo,
} from "@/components/editor/actions";
import { TOOLS } from "@/components/editor/tools";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Rotation, type VirtualPage } from "@/lib/pdf/types";
import { editorStore, useEditor } from "@/lib/store/editor";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";

const NO_PAGES: VirtualPage[] = [];

const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-foreground-subtle";

const itemClass =
  "flex cursor-default select-none items-center gap-2.5 rounded-sm px-2 py-2 text-sm text-foreground outline-none data-[selected=true]:bg-surface-hover data-[disabled=true]:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-foreground-subtle";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Puts the cursor in the document name field in the header. */
  onRename: () => void;
  onExport: () => void;
}

function PaletteItem({
  children,
  onSelect,
  disabled,
  keys,
}: {
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  keys?: string;
}) {
  return (
    <Command.Item className={itemClass} onSelect={onSelect} disabled={disabled}>
      {children}
      {keys === undefined ? null : <Kbd className="ml-auto">{keys}</Kbd>}
    </Command.Item>
  );
}

export function CommandPalette({ open, onOpenChange, onRename, onExport }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const pages = useWorkspace((s) => s.workspace?.pages) ?? NO_PAGES;
  const selectedCount = useEditor((s) => s.selectedPageIds.size);
  const activePageId = useEditor((s) => s.activePageId);

  const change = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const run = (action: () => void) => () => {
    change(false);
    action();
  };

  const requested = Number.parseInt(query, 10);
  const target =
    Number.isInteger(requested) && requested >= 1 && requested <= pages.length
      ? pages[requested - 1]
      : undefined;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent showClose={false} className="max-w-xl p-0">
        <DialogTitle className="sr-only">Find a command</DialogTitle>
        <Command label="Find a command" className="overflow-hidden">
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search actions, or type a page number"
            className="h-12 w-full border-b border-border bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-foreground-subtle"
          />
          <Command.List className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
            <Command.Empty className="px-2 py-6 text-center text-sm text-foreground-muted">
              Nothing matches that.
            </Command.Empty>

            {target === undefined ? null : (
              <Command.Group>
                <PaletteItem onSelect={run(() => scrollToPage(target.id))}>
                  <ArrowRight />
                  Go to page {requested}
                </PaletteItem>
              </Command.Group>
            )}

            <Command.Group heading="Pages" className={groupClass}>
              <PaletteItem
                onSelect={run(() => rotateSelected(Rotation.R90))}
                disabled={selectedCount === 0}
                keys="R"
              >
                <RotateCw />
                Rotate selected pages right
              </PaletteItem>
              <PaletteItem
                onSelect={run(() => rotateSelected(Rotation.R270))}
                disabled={selectedCount === 0}
                keys="⇧R"
              >
                <RotateCcw />
                Rotate selected pages left
              </PaletteItem>
              <PaletteItem onSelect={run(duplicateSelected)} disabled={selectedCount === 0}>
                <Copy />
                Duplicate selected pages
              </PaletteItem>
              <PaletteItem
                onSelect={run(() => {
                  if (activePageId !== null) insertBlankAfter(activePageId);
                })}
                disabled={activePageId === null}
              >
                <SquarePlus />
                Insert a blank page after this one
              </PaletteItem>
              <PaletteItem onSelect={run(() => void extractSelected())} disabled={selectedCount === 0}>
                <FileOutput />
                Extract selected pages to a new document
              </PaletteItem>
              <PaletteItem onSelect={run(deleteSelected)} disabled={selectedCount === 0}>
                <Trash2 />
                Delete selected pages
              </PaletteItem>
            </Command.Group>

            <Command.Group heading="Document" className={groupClass}>
              <PaletteItem
                onSelect={run(() => {
                  // The toolbar owns the only file input; reuse it rather than mounting a second.
                  document
                    .querySelector<HTMLInputElement>('[data-testid="add-files-input"]')
                    ?.click();
                })}
              >
                <FilePlus2 />
                Add files
              </PaletteItem>
              <PaletteItem onSelect={run(onRename)}>
                <PenLine />
                Rename this document
              </PaletteItem>
              <PaletteItem onSelect={run(() => workspaceStore.getState().undo())}>
                <Undo2 />
                Undo
              </PaletteItem>
              <PaletteItem onSelect={run(() => workspaceStore.getState().redo())}>
                <Redo2 />
                Redo
              </PaletteItem>
              <PaletteItem onSelect={run(onExport)}>
                <Download />
                Export as PDF
              </PaletteItem>
            </Command.Group>

            <Command.Group heading="Tools" className={groupClass}>
              {TOOLS.map(({ tool, label, keys, icon: Icon }) => (
                <PaletteItem
                  key={tool}
                  keys={keys}
                  onSelect={run(() => editorStore.getState().setTool(tool))}
                >
                  <Icon />
                  {label} tool
                </PaletteItem>
              ))}
            </Command.Group>

            <Command.Group heading="View" className={groupClass}>
              <PaletteItem onSelect={run(() => editorStore.getState().setZoomMode("fit-width"))}>
                <Maximize2 />
                Fit width
              </PaletteItem>
              <PaletteItem onSelect={run(() => editorStore.getState().setZoomMode("fit-page"))}>
                <Maximize2 />
                Fit page
              </PaletteItem>
              <PaletteItem onSelect={run(() => zoomTo(1))}>
                <Maximize2 />
                Zoom to 100%
              </PaletteItem>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
