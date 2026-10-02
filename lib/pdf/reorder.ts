import type { PageId } from "@/lib/pdf/types";

/**
 * Where a drag of `movingIds` onto the card `overId` should land, as a `movePages` index: the
 * position `overId` holds once the moving block is removed. `null` means nothing should move.
 */
export function computeDropIndex(
  order: PageId[],
  movingIds: PageId[],
  overId: PageId,
): number | null {
  const moving = new Set(movingIds);
  if (moving.size === 0 || moving.has(overId)) return null;
  const overIndex = order.indexOf(overId);
  if (overIndex === -1) return null;
  let movedFromBefore = 0;
  for (let i = 0; i < overIndex; i++) {
    if (moving.has(order[i])) movedFromBefore++;
  }
  return overIndex - movedFromBefore;
}
