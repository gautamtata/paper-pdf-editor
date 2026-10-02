"use client";

import { useSyncExternalStore } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** The platform never changes under us, so there is nothing to subscribe to. */
const noChanges = () => () => {};
const onThisPlatform = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl");
const onTheServer = () => "Ctrl";

/** How to spell the command modifier: "⌘" on Apple platforms, "Ctrl" elsewhere. */
const useModKey = (): string => useSyncExternalStore(noChanges, onThisPlatform, onTheServer);

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 select-none items-center justify-center rounded-xs border border-border bg-surface px-1 font-mono text-[0.6875rem] leading-none text-foreground-subtle shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd, useModKey };
