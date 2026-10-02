import type * as React from "react";
import { cn } from "@/lib/utils";

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

export { Kbd };
