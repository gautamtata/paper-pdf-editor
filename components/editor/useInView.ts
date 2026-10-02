"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Whether the element is inside the viewport grown by `rootMargin`. Clipping ancestors count, so
 * a card scrolled out of the rail stops rendering even though the rail itself is on screen.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin: string): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
