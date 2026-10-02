"use client";

import type { ReactElement } from "react";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HintProps {
  label: string;
  keys?: string;
  note?: string;
  /** Has to be a DOM element: the tooltip hands it the trigger's props. */
  children: ReactElement;
}

/** The toolbar's tooltip: a label, an aside, and the keystroke that does the same thing. */
export function Hint({ label, keys, note, children }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top">
        {label}
        {note === undefined ? null : <span className="opacity-60">{note}</span>}
        {keys === undefined ? null : (
          <Kbd className="border-transparent bg-white/15 text-paper-100 dark:bg-black/10 dark:text-paper-800">
            {keys}
          </Kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
