import { describe, expect, it } from "vitest";
import { addRotation, newId, normalizeRotation, Rotation } from "@/lib/pdf/types";

describe("normalizeRotation", () => {
  it("keeps canonical angles", () => {
    expect(normalizeRotation(0)).toBe(Rotation.R0);
    expect(normalizeRotation(270)).toBe(Rotation.R270);
  });

  it("wraps negative and overflowing angles", () => {
    expect(normalizeRotation(-90)).toBe(Rotation.R270);
    expect(normalizeRotation(-450)).toBe(Rotation.R270);
    expect(normalizeRotation(360)).toBe(Rotation.R0);
    expect(normalizeRotation(450)).toBe(Rotation.R90);
  });

  it("snaps off-quadrant angles to the nearest quarter turn", () => {
    expect(normalizeRotation(89)).toBe(Rotation.R90);
    expect(normalizeRotation(179)).toBe(Rotation.R180);
  });
});

describe("addRotation", () => {
  it("adds modulo 360", () => {
    expect(addRotation(Rotation.R90, Rotation.R180)).toBe(Rotation.R270);
    expect(addRotation(Rotation.R270, Rotation.R180)).toBe(Rotation.R90);
    expect(addRotation(Rotation.R270, Rotation.R90)).toBe(Rotation.R0);
  });
});

describe("newId", () => {
  it("returns distinct 10-character ids", () => {
    const ids = new Set(Array.from({ length: 100 }, newId));
    expect(ids.size).toBe(100);
    expect([...ids].every((id) => id.length === 10)).toBe(true);
  });
});
