"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

type ThumbProps = React.ComponentProps<typeof SliderPrimitive.Thumb>;

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
  /**
   * Radix puts `role="slider"` on the thumb, not the root, so anything that
   * labels or describes the control has to land there. `aria-label` /
   * `aria-labelledby` are forwarded to every thumb; pass an array to label the
   * thumbs of a range slider individually.
   */
  thumbProps?: ThumbProps | ThumbProps[];
};

function Slider({
  className,
  thumbProps,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: SliderProps) {
  const thumbCount = props.value?.length ?? props.defaultValue?.length ?? 1;
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-5 data-[orientation=vertical]:flex-col data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-surface-sunken data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5">
        <SliderPrimitive.Range className="absolute bg-accent data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, i) => {
        const { className: thumbClassName, ...thumb } = Array.isArray(thumbProps)
          ? (thumbProps[i] ?? {})
          : (thumbProps ?? {});
        return (
          <SliderPrimitive.Thumb
            key={i}
            data-slot="slider-thumb"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            {...thumb}
            className={cn(
              "block size-4 shrink-0 rounded-full border-2 border-accent bg-surface shadow-raised transition-[box-shadow,transform] hover:scale-110 active:scale-105",
              thumbClassName,
            )}
          />
        );
      })}
    </SliderPrimitive.Root>
  );
}

export { Slider, type SliderProps };
