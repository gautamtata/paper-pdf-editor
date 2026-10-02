"use client";

import { ImageUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SignatureImage } from "@/lib/signature/image";
import { cn } from "@/lib/utils";

/** Transparency has to be visible, or a photo that kept its paper looks fine until it is placed. */
const CHECKERBOARD = {
  backgroundImage: "repeating-conic-gradient(var(--surface-hover) 0% 25%, var(--surface) 0% 50%)",
  backgroundSize: "14px 14px",
};

interface SignatureUploadProps {
  image: SignatureImage | null;
  busy: boolean;
  onPick(file: File): void;
}

export function SignatureUpload({ image, busy, onPick }: SignatureUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const href = useMemo(
    () =>
      image === null
        ? null
        : URL.createObjectURL(new Blob([image.png as BlobPart], { type: "image/png" })),
    [image],
  );
  useEffect(() => {
    if (href === null) return;
    return () => URL.revokeObjectURL(href);
  }, [href]);

  const stopDragging = () => {
    depth.current = 0;
    setDragging(false);
  };

  return (
    <div
      className={cn(
        "relative flex h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-strong text-center transition-colors",
        dragging && "border-solid border-accent bg-accent-soft/40",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) stopDragging();
      }}
      onDrop={(e) => {
        e.preventDefault();
        stopDragging();
        const file = e.dataTransfer.files[0];
        if (file !== undefined) onPick(file);
      }}
    >
      <input
        ref={inputRef}
        data-testid="signature-image-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file !== undefined) onPick(file);
          e.target.value = "";
        }}
      />

      {href === null ? (
        <>
          <ImageUp className="size-6 text-foreground-subtle" strokeWidth={1.5} />
          <p className="text-sm text-foreground-muted">
            {dragging ? "Let go to use that photo" : "Drop a photo of your signature"}
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Reading…" : "Choose a photo"}
          </Button>
          <p className="max-w-80 text-xs text-foreground-subtle">
            Sign a white sheet, photograph it, and the paper is dropped out for you.
          </p>
        </>
      ) : (
        <>
          <div
            className="absolute inset-2 rounded-md"
            style={CHECKERBOARD}
            aria-hidden
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, not an asset */}
          <img
            src={href}
            alt="Your signature with the background removed"
            data-testid="signature-upload-preview"
            className="relative max-h-36 max-w-[90%] object-contain"
          />
          <Button
            variant="secondary"
            size="sm"
            className="relative h-7 px-2.5 text-xs"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Use a different photo
          </Button>
        </>
      )}
    </div>
  );
}
