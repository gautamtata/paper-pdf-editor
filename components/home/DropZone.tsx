"use client";

import { FileUp } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isPdfFile } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;
const transition = { duration: 0.15, ease };

/**
 * The single place picked files are filtered: one warning per gesture, however many
 * non-PDFs it carried, so `useOpenFiles` can trust everything it is handed.
 */
const pdfsFrom = (files: File[]): File[] => {
  const pdfs = files.filter(isPdfFile);
  if (pdfs.length < files.length) toast.error("Only PDF files are supported");
  return pdfs;
};

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  busy?: boolean;
}

export function DropZone({ onFiles, busy = false }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire for every child, so a depth counter keeps the
  // highlight from flickering as the pointer crosses the icon or the button.
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length === 0) return;
      e.preventDefault();
      onFiles(pdfsFrom(files));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onFiles]);

  const stopDragging = () => {
    depth.current = 0;
    setDragging(false);
  };

  return (
    // `reducedMotion="user"` keeps the opacity cross-fade but drops the transforms.
    <MotionConfig reducedMotion="user">
      <motion.section
        data-testid="drop-zone"
        data-dragging={dragging ? "true" : undefined}
        aria-label="Add PDFs"
        animate={{ scale: dragging ? 1.008 : 1 }}
        transition={transition}
        className="relative isolate flex min-h-64 flex-col items-center justify-center gap-5 rounded-xl bg-surface px-6 py-14 text-center shadow-page sm:min-h-72"
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
          onFiles(pdfsFrom(Array.from(e.dataTransfer?.files ?? [])));
        }}
      >
        <motion.span
          aria-hidden
          animate={{ opacity: dragging ? 0 : 1 }}
          transition={transition}
          className="pointer-events-none absolute inset-0 -z-10 rounded-xl border-2 border-dashed border-border-strong"
        />
        <motion.span
          aria-hidden
          animate={{ opacity: dragging ? 1 : 0 }}
          transition={transition}
          className="pointer-events-none absolute inset-0 -z-10 rounded-xl border-2 border-accent bg-accent-soft/50"
        />

        <motion.span
          aria-hidden
          animate={{ y: dragging ? -4 : 0 }}
          transition={transition}
          className="text-foreground-subtle data-[active=true]:text-accent transition-colors"
          data-active={dragging ? "true" : "false"}
        >
          <FileUp className="size-7" strokeWidth={1.5} />
        </motion.span>

        <div className="space-y-1.5">
          <p className="text-[0.9375rem] font-medium text-foreground">
            {dragging ? "Let go to open" : "Drop a PDF here"}
          </p>
          <p className="text-sm text-foreground-muted">
            Merge, reorder, annotate, sign, and export it again.
          </p>
        </div>

        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            // `accept` is only a hint; the picker can still return other types.
            onFiles(pdfsFrom(Array.from(e.target.files ?? [])));
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="md"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Opening…" : "Choose PDFs"}
        </Button>
        <p className="text-xs text-foreground-subtle">Or paste one from your clipboard</p>
      </motion.section>
    </MotionConfig>
  );
}
