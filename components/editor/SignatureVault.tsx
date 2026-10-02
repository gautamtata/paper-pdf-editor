"use client";

import { X } from "lucide-react";
import { useMemo } from "react";
import type { StoredSignature } from "@/lib/storage/repo";
import { pngDataUrl } from "@/lib/utils";

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
  const href = useMemo(() => pngDataUrl(signature.png), [signature.png]);

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        title={`Place ${signature.name}`}
        data-testid="saved-signature"
        className="flex h-14 w-28 items-center justify-center rounded-md border border-border bg-paper-50 px-2 transition-colors hover:border-accent disabled:opacity-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, not an asset */}
        <img src={href} alt={signature.name} className="max-h-10 max-w-full object-contain" />
      </button>
      {/* Faded rather than `hidden`: a `display: none` button cannot be tabbed to, which left the
          keyboard with no way to delete a signature. It only takes clicks once it shows. */}
      <button
        type="button"
        aria-label={`Delete ${signature.name}`}
        onClick={onDelete}
        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-surface-raised text-foreground-muted opacity-0 shadow-soft transition-opacity hover:bg-danger hover:text-danger-foreground group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 pointer-events-none"
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
