"use client";

import { Input } from "@/components/ui/input";
import { rgbToCss, type RGB } from "@/lib/annotations/types";
import { typedSignatureLayout } from "@/lib/signature/typed";

interface SignatureTypedProps {
  text: string;
  color: RGB;
  onTextChange(text: string): void;
}

/** The preview is the exported SVG's own geometry, scaled to the panel, so the two always agree. */
export function SignatureTyped({ text, color, onTextChange }: SignatureTypedProps) {
  const trimmed = text.trim();
  const layout = typedSignatureLayout(trimmed);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-48 overflow-hidden rounded-lg border border-border-strong bg-paper-50 dark:bg-paper-900">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 bottom-12 flex items-end gap-2"
        >
          <span className="-mb-2 text-sm text-foreground-subtle">&#10005;</span>
          <span className="h-px flex-1 bg-border-strong/60" />
        </div>
        {trimmed === "" ? (
          <span className="absolute inset-0 flex items-center justify-center font-hand text-3xl text-foreground-subtle/70">
            Your name, in your hand
          </span>
        ) : (
          <svg
            role="img"
            aria-label={`Signature preview: ${trimmed}`}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-x-8 bottom-14 top-4"
          >
            <text
              x={layout.x}
              y={layout.y}
              fontSize={layout.fontSize}
              fill={rgbToCss(color)}
              className="font-hand"
            >
              {trimmed}
            </text>
          </svg>
        )}
      </div>
      <Input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        maxLength={48}
        autoComplete="name"
        aria-label="Name to sign with"
        placeholder="Type your name"
        className="font-hand text-lg"
      />
    </div>
  );
}
