import { hexToRgb, type RGB } from "@/lib/annotations/types";

export interface Preset {
  name: string;
  hex: string;
}

/**
 * Ink colours are document content, not chrome, so they are stored as real sRGB and shown as
 * themselves. These are the sRGB values of the `--color-marker-*` family and darker siblings of it,
 * so the swatch row sits in the same palette as the rest of the app.
 */
export const INK_PRESETS: Preset[] = [
  { name: "Ink", hex: "#212d47" },
  { name: "Black", hex: "#000000" },
  { name: "Red", hex: "#d4212d" },
  { name: "Blue", hex: "#2a5397" },
  { name: "Green", hex: "#1d7d3e" },
  { name: "Purple", hex: "#5c2f95" },
];

export const HIGHLIGHT_PRESETS: Preset[] = [
  { name: "Yellow", hex: "#ffdf50" },
  { name: "Orange", hex: "#ffc06a" },
  { name: "Green", hex: "#82ec9c" },
  { name: "Blue", hex: "#90d7ff" },
  { name: "Pink", hex: "#ffa7d6" },
  { name: "Purple", hex: "#d5baff" },
];

const channel = (v: number): string =>
  Math.round(Math.min(Math.max(v, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");

export const rgbToHex = (c: RGB): string => `#${channel(c.r)}${channel(c.g)}${channel(c.b)}`;

/** `null` for anything a colour input would not produce, so a half-typed value is ignored. */
export const parseHex = (value: string): RGB | null => {
  try {
    return hexToRgb(value);
  } catch {
    return null;
  }
};
