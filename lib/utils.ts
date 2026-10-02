import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** 1 outside a browser, so render scales stay sane during SSR. */
export const dpr = (): number =>
  typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

const BYTE_UNITS = ["KB", "MB", "GB"] as const;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

/** Browsers leave `type` empty for some picked files, so the extension is a fallback. */
export const isPdfFile = (file: File): boolean =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

/**
 * PNG bytes as a `data:` URL. An object URL would be cheaper, but it has to be revoked, and a
 * revoke from React's double-invoked development effects outlives the `useMemo` that made it,
 * leaving a broken image behind. A data URL has no lifetime to get wrong.
 */
export function pngDataUrl(png: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < png.length; i += CHUNK) {
    binary += String.fromCharCode(...png.subarray(i, i + CHUNK));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  // `Uint8Array` is generic over ArrayBufferLike, which TS will not narrow to
  // BlobPart (it could be SharedArrayBuffer-backed); ours never is.
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  a.click();
  // Revoking immediately can abort the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
