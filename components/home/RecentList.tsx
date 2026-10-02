"use client";

import { FileText, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { repo, type WorkspaceSummary } from "@/lib/storage/repo";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Coarse, glanceable ages; anything older than a week gets a date. */
function relativeTime(at: number): string {
  const ago = Math.max(0, Date.now() - at);
  if (ago < MINUTE) return "just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} hr ago`;
  if (ago < 2 * DAY) return "yesterday";
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Thumbnail({ item }: { item: WorkspaceSummary }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-surface ring-1 ring-border transition-shadow group-hover:shadow-page">
      {item.thumbnail === undefined ? (
        <span className="flex h-full items-center justify-center text-foreground-subtle/60">
          <FileText className="size-8" strokeWidth={1.25} />
        </span>
      ) : (
        // A stored data URL, not a remote asset: next/image would only add a loader.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail}
          alt=""
          className="h-full w-full object-cover object-top"
          draggable={false}
        />
      )}
    </div>
  );
}

function RecentCard({ item, onDelete }: { item: WorkspaceSummary; onDelete: () => void }) {
  return (
    <li className="group relative">
      <Link
        href={`/edit/${item.id}`}
        className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <Thumbnail item={item} />
        <p className="mt-3 truncate text-sm font-medium text-foreground">{item.name}</p>
        <p className="mt-0.5 flex justify-between gap-2 text-xs text-foreground-subtle">
          <span>
            {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}
          </span>
          <time dateTime={new Date(item.updatedAt).toISOString()}>
            {relativeTime(item.updatedAt)}
          </time>
        </p>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${item.name}`}
            className="absolute right-1.5 top-1.5 size-7 rounded-sm bg-surface-raised text-foreground-muted opacity-0 shadow-soft transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function ClearDataDialog({ onCleared }: { onCleared: () => void }) {
  const [open, setOpen] = useState(false);

  const clear = async () => {
    try {
      await repo.clearAll();
      toast.success("Local data cleared");
      onCleared();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't clear local data");
    } finally {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xs underline decoration-border-strong decoration-1 underline-offset-4 transition-colors hover:text-foreground"
      >
        Clear all local data
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all local data?</DialogTitle>
          <DialogDescription>
            Every document and signature saved in this browser is removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Keep my data</Button>
          </DialogClose>
          <Button variant="destructive" onClick={clear}>
            Clear everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecentList() {
  const [items, setItems] = useState<WorkspaceSummary[] | null>(null);

  const reload = useCallback(() => {
    repo
      .listWorkspaces()
      .then(setItems)
      .catch((err: unknown) => {
        console.error(err);
        setItems([]);
        toast.error("Couldn't read your saved documents");
      });
  }, []);

  useEffect(reload, [reload]);

  const remove = async (item: WorkspaceSummary) => {
    try {
      await repo.deleteWorkspace(item.id);
      toast.success(`Deleted ${item.name}`);
    } catch (err) {
      console.error(err);
      toast.error(`Couldn't delete ${item.name}`);
    }
    reload();
  };

  if (items === null) return null;

  return (
    <section aria-labelledby="recent-heading" className="mt-16">
      <h2
        id="recent-heading"
        className="text-xs font-medium tracking-wide text-foreground-subtle"
      >
        Recent
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-foreground-muted">No recent documents yet</p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <RecentCard key={item.id} item={item} onDelete={() => void remove(item)} />
          ))}
        </ul>
      )}
      <div className="mt-16 border-t border-border pt-5 text-xs text-foreground-subtle">
        <ClearDataDialog onCleared={reload} />
      </div>
    </section>
  );
}
