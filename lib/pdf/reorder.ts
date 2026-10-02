import type { PageId } from "@/lib/pdf/types";

/**
 * Where a drag of `movingIds` onto the card `overId` should land, as a `movePages` index (measured
 * against the array with the block removed). Matches what dnd-kit's sortable preview shows: a block
 * dragged forward lands just after the card it was dropped on, one dragged backward just before it.
 * `null` means nothing should move.
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
  let firstMoving = -1;
  for (let i = 0; i < order.length; i++) {
    if (!moving.has(order[i])) continue;
    if (firstMoving === -1) firstMoving = i;
    if (i < overIndex) movedFromBefore++;
  }
  if (firstMoving === -1) return null;

  // Where the card dropped on sits once the block is gone.
  const target = overIndex - movedFromBefore;
  return overIndex > firstMoving ? target + 1 : target;
}
