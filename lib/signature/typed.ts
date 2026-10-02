import { rgbToCss, type RGB } from "@/lib/annotations/types";
import {
  canvasToPng,
  createCanvas,
  loadImage,
  trimCanvas,
  type SignatureImage,
} from "@/lib/signature/image";

const HAND_FAMILY = "Caveat Variable";
const FONT_SIZE = 72;
/** The box the text is laid out in. Generous: an SVG clips whatever overflows it, and the result
    is trimmed to the glyphs afterwards anyway. */
const HEIGHT = 180;
const BASELINE = 120;
const SIDE = 24;
const PER_CHAR = 48;
/** Rasterise above the placed size, so the ink stays crisp when the page is zoomed in. */
const EXPORT_SCALE = 2;

export interface TypedLayout {
  width: number;
  height: number;
  /** The text anchor: the start of the baseline. */
  x: number;
  y: number;
  fontSize: number;
}

/** Shared by the SVG and the live preview, so what the reader sees is what gets placed. */
export const typedSignatureLayout = (text: string): TypedLayout => ({
  width: SIDE * 2 + Math.max(text.length, 1) * PER_CHAR,
  height: HEIGHT,
  x: SIDE,
  y: BASELINE,
  fontSize: FONT_SIZE,
});

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function typedSignatureSvg(text: string, color: RGB): string {
  const { width, height, x, y, fontSize } = typedSignatureLayout(text);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<text x="${x}" y="${y}" font-family="${HAND_FAMILY}, cursive" ` +
    `font-size="${fontSize}" fill="${rgbToCss(color)}">${escapeXml(text)}</text></svg>`
  );
}

const base64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

/** Chromium prints the basic-latin subset's range as `U+0-FF`, Firefox as `U+0000-00FF`. */
const BASIC_LATIN = /^u\+0+(?:-0*ff)?(?:,|$)/;

const coversLatin = (rule: CSSFontFaceRule): boolean =>
  BASIC_LATIN.test(rule.style.getPropertyValue("unicode-range").toLowerCase().replace(/\s/g, ""));

/** The hand font's own `@font-face`, preferring the latin subset a name is written in. */
function handFontUrl(): string | null {
  const faces: { rule: CSSFontFaceRule; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule && rule.style.fontFamily.includes(HAND_FAMILY)) {
          faces.push({ rule, base: sheet.href ?? document.baseURI });
        }
      }
    } catch {
      // A cross-origin stylesheet hides its rules; ours are same-origin.
    }
  }
  const face = faces.find(({ rule }) => coversLatin(rule)) ?? faces[0];
  if (face === undefined) return null;
  const url = /url\(["']?([^"')]+)["']?\)/.exec(face.rule.style.getPropertyValue("src"))?.[1];
  // `src` keeps the url as it was authored: relative to its stylesheet, not to the page.
  return url === undefined ? null : new URL(url, face.base).href;
}

let inlined: Promise<string> | null = null;

/**
 * An `<img>` renders SVG in an isolated document that cannot see the page's web fonts, so the
 * hand has to travel inside the SVG as data or the export falls back to a system script face.
 */
function handFontCss(): Promise<string> {
  return (inlined ??= (async () => {
    const url = handFontUrl();
    if (url === null) return "";
    const response = await fetch(url);
    const data = base64(await response.arrayBuffer());
    return `@font-face{font-family:"${HAND_FAMILY}";src:url(data:font/woff2;base64,${data}) format("woff2")}`;
  })().catch(() => ""));
}

const withFont = (svg: string, css: string): string =>
  css === "" ? svg : svg.replace(">", `><defs><style>${css}</style></defs>`);

export async function svgToPng(svg: string): Promise<SignatureImage> {
  await document.fonts.load(`${FONT_SIZE}px "${HAND_FAMILY}"`).catch(() => []);
  const url = URL.createObjectURL(
    new Blob([withFont(svg, await handFontCss())], { type: "image/svg+xml" }),
  );
  try {
    const img = await loadImage(url);
    const canvas = createCanvas(img.naturalWidth * EXPORT_SCALE, img.naturalHeight * EXPORT_SCALE);
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("This browser can't draw the signature");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const trimmed = trimCanvas(canvas);
    if (trimmed === null) throw new Error("Type a name to sign with");
    return canvasToPng(trimmed);
  } finally {
    URL.revokeObjectURL(url);
  }
}
