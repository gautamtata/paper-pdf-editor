"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RenderFailedProps {
  onRetry: () => void;
  /** Cards have no room for a sentence; the viewer does. */
  compact?: boolean;
  className?: string;
}

/** Shown over a page box whose render failed, so a blank page is never the only signal. */
export function RenderFailed({ onRetry, compact = false, className }: RenderFailedProps) {
  return (
    <div
      role="alert"
      data-testid="render-failed"
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-sunken/90 text-foreground-muted",
        compact ? "text-[0.625rem]" : "text-sm",
        className,
      )}
    >
      <span>Couldn&apos;t render</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm bg-surface-raised px-2 py-1 font-medium text-accent shadow-soft transition-colors hover:bg-surface-hover",
          compact && "px-1.5 py-0.5",
        )}
      >
        <RefreshCw className={compact ? "size-2.5" : "size-3.5"} />
        Retry
      </button>
    </div>
  );
}
