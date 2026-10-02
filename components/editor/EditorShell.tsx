"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CommandPalette } from "@/components/editor/CommandPalette";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { PageViewer } from "@/components/editor/PageViewer";
import { ThumbnailRail } from "@/components/editor/ThumbnailRail";
import { Toolbar } from "@/components/editor/Toolbar";
import { useAutosaveThumbnail } from "@/components/editor/useAutosaveThumbnail";
import { useShortcuts } from "@/components/editor/useShortcuts";
import { StorageBanner } from "@/components/StorageBanner";
import { Button } from "@/components/ui/button";
import { repo } from "@/lib/storage/repo";
import { editorStore } from "@/lib/store/editor";
import { startAutosave, useWorkspace, workspaceStore } from "@/lib/store/workspace";
import { cn } from "@/lib/utils";

/** The shell only renders in the browser (a loaded workspace), so there is no server snapshot. */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export function EditorShell({ workspaceId }: { workspaceId: string }) {
  const [missing, setMissing] = useState(false);
  // `null` until the reader decides: the rail starts open on a wide screen, closed on a narrow one.
  const [railOpen, setRailOpen] = useState<boolean | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);
  const workspace = useWorkspace((s) => s.workspace);
  const nameRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useAutosaveThumbnail();

  useEffect(() => {
    // The store already holds it when we arrive straight from creating it.
    if (workspaceStore.getState().workspace?.id === workspaceId) return;
    let cancelled = false;
    repo
      .getWorkspace(workspaceId)
      .then((ws) => {
        if (cancelled) return;
        if (ws === undefined) {
          setMissing(true);
          return;
        }
        workspaceStore.getState().load(ws);
        // Page ids from whatever was open before mean nothing here.
        editorStore.getState().clearSelection();
        editorStore.getState().setActivePage(null);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    let unsaved = false;
    const stopAutosave = startAutosave(async (ws) => {
      await repo.saveWorkspace(ws, thumbnailRef.current);
      unsaved = false;
    });
    const unsubscribe = workspaceStore.subscribe((state, prev) => {
      const next = state.workspace;
      if (next === null || next === prev.workspace) return;
      if (prev.workspace?.id === next.id) unsaved = true;
    });
    // `startAutosave`'s disposer only drops its timer, so an edit mid-debounce is written here.
    const flush = () => {
      const ws = workspaceStore.getState().workspace;
      if (!unsaved || ws === null) return;
      unsaved = false;
      void repo.saveWorkspace(ws, thumbnailRef.current);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      stopAutosave();
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [thumbnailRef]);

  useEffect(() => {
    // A document opens showing a whole page; fit width stays a keystroke (⌘0) away.
    editorStore.getState().setZoomMode("fit-page");
  }, [workspaceId]);

  useShortcuts({
    displayScale,
    onOpenPalette: () => setPaletteOpen(true),
  });

  const wide = useMediaQuery("(min-width: 900px)");
  const railVisible = railOpen ?? wide;
  const open = workspace?.id === workspaceId ? workspace : null;

  if (open === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {missing ? (
          <>
            <p className="text-sm text-foreground">We can&apos;t find that document.</p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/">Back to Paper</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-foreground-subtle">Opening…</p>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <StorageBanner />
      <EditorHeader
        name={open.name}
        pageCount={open.pages.length}
        railOpen={railVisible}
        onToggleRail={() => setRailOpen(!railVisible)}
        onOpenPalette={() => setPaletteOpen(true)}
        nameRef={nameRef}
      />

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Pages"
          className={cn(
            "z-20 shrink-0 flex-col bg-surface-sunken",
            "min-[900px]:w-70 min-[900px]:border-r min-[900px]:border-border",
            // Below 900px the rail is a sheet over the viewer, clear of the toolbar.
            "max-[899px]:fixed max-[899px]:inset-x-0 max-[899px]:bottom-0 max-[899px]:h-[46dvh]",
            "max-[899px]:rounded-t-xl max-[899px]:border-t max-[899px]:border-border max-[899px]:pb-16 max-[899px]:shadow-overlay",
            railVisible ? "flex" : "hidden",
          )}
        >
          <ThumbnailRail className="flex-1" />
        </aside>

        {/* The toolbar floats over the pages, centred on them rather than on the window. */}
        <div className="relative flex min-w-0 flex-1">
          <PageViewer onDisplayScale={setDisplayScale} />
          <Toolbar displayScale={displayScale} />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onRename={() => {
          nameRef.current?.focus();
          nameRef.current?.select();
        }}
      />
    </main>
  );
}
