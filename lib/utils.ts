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
