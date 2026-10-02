"use client";

import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { StoredSignature } from "@/lib/storage/repo";

interface SignatureVaultProps {
  signatures: StoredSignature[];
  busy: boolean;
  onPick(signature: StoredSignature): void;
  onDelete(id: string): void;
}

function SignatureChip({
  signature,
  busy,
  onPick,
  onDelete,
}: {
  signature: StoredSignature;
  busy: boolean;
  onPick(): void;
  onDelete(): void;
}) {
  const href = useMemo(
    () => URL.createObjectURL(new Blob([signature.png as BlobPart], { type: "image/png" })),
    [signature.png],
  );
  useEffect(() => () => URL.revokeObjectURL(href), [href]);

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        title={`Place ${signature.name}`}
        data-testid="saved-signature"
        className="flex h-14 w-28 items-center justify-center rounded-md border border-border bg-paper-50 px-2 transition-colors hover:border-accent disabled:opacity-50 dark:bg-paper-900"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, not an asset */}
        <img src={href} alt={signature.name} className="max-h-10 max-w-full object-contain" />
      </button>
      <button
        type="button"
        aria-label={`Delete ${signature.name}`}
        onClick={onDelete}
        className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border border-border bg-surface-raised text-foreground-muted shadow-soft transition-colors hover:bg-danger hover:text-danger-foreground group-hover:flex focus-visible:flex"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/** The saved strip: one press places a signature again, no drawing required. */
export function SignatureVault({ signatures, busy, onPick, onDelete }: SignatureVaultProps) {
  return (
    <section aria-label="Saved signatures" className="mt-4">
      <h3 className="text-xs font-medium text-foreground-muted">Saved</h3>
      {signatures.length === 0 ? (
        <p className="mt-2 text-xs text-foreground-subtle">
          Signatures you save show up here, ready to place on any document.
        </p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 pt-1.5">
          {signatures.map((signature) => (
            <SignatureChip
              key={signature.id}
              signature={signature}
              busy={busy}
              onPick={() => onPick(signature)}
              onDelete={() => onDelete(signature.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
