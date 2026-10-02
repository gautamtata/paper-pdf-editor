"use client";

import { FilePlus2, Redo2, Undo2 } from "lucide-react";
import { useRef } from "react";
import { addFiles } from "@/components/editor/actions";
import { ExportButton } from "@/components/editor/ExportButton";
import { Hint } from "@/components/editor/Hint";
import { TOOLS, TOOL_TEST_IDS } from "@/components/editor/tools";
import { ZoomMenu } from "@/components/editor/ZoomMenu";
import { Button } from "@/components/ui/button";
import { useModKey } from "@/components/ui/kbd";
import { editorStore, useEditor } from "@/lib/store/editor";
import { useWorkspace, workspaceStore } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";

const Divider = () => <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border" />;

interface ToolbarProps {
  displayScale: number;
  onExport: () => void;
  exporting: boolean;
}

export function Toolbar({ displayScale, onExport, exporting }: ToolbarProps) {
  const tool = useEditor((s) => s.tool);
  const canUndo = useWorkspace((s) => s.past.length > 0);
  const canRedo = useWorkspace((s) => s.future.length > 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mod = useModKey();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface-raised/90 p-1.5 shadow-overlay backdrop-blur-md">
        <div
          role="radiogroup"
          aria-label="Tool"
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-sunken p-0.5"
        >
          {TOOLS.map(({ tool: value, label, keys, note, icon: Icon }) => {
            const selected = tool === value;
            return (
              <Hint key={value} label={label} keys={keys} note={note}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  data-testid={TOOL_TEST_IDS[value]}
                  onClick={() => editorStore.getState().setTool(value)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground shadow-soft"
                      : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              </Hint>
            );
          })}
        </div>

        <Divider />

        <input
          ref={inputRef}
          data-testid="add-files-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Hint label="Add PDFs to this document">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 rounded-full"
            onClick={() => inputRef.current?.click()}
          >
            <FilePlus2 className="size-4" />
            Add files
          </Button>
        </Hint>

        <Hint label="Undo" keys={`${mod}Z`}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            disabled={!canUndo}
            className="size-8 rounded-full"
            onClick={() => workspaceStore.getState().undo()}
          >
            <Undo2 className="size-4" />
          </Button>
        </Hint>
        <Hint label="Redo" keys={`${mod}⇧Z`}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            disabled={!canRedo}
            className="size-8 rounded-full"
            onClick={() => workspaceStore.getState().redo()}
          >
            <Redo2 className="size-4" />
          </Button>
        </Hint>

        <Divider />
        <ZoomMenu displayScale={displayScale} />
        <Divider />

        <ExportButton onExport={onExport} running={exporting} />
      </div>
    </div>
  );
}
