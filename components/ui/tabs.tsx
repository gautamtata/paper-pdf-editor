"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** A segmented control: one sunken track, the active segment lifted out of it. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-sunken p-0.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-7 select-none items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium text-foreground-muted transition-colors",
        "hover:text-foreground",
        "data-[state=active]:bg-surface-raised data-[state=active]:text-foreground data-[state=active]:shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
