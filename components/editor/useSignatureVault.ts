"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { repo, type StoredSignature } from "@/lib/storage/repo";

export interface SignatureVault {
  /** Newest first, as the repo lists them. */
  signatures: StoredSignature[];
  /** The next unused "Signature N", for the name field's default. */
  nextName(): string;
  /** `false` when storage refused it, which the reader has already been told about. */
  save(name: string, png: Uint8Array): Promise<boolean>;
  remove(id: string): Promise<void>;
}

const NUMBERED = /^Signature (\d+)$/;

/** The saved signatures, kept in step with local storage. One instance per editor. */
export function useSignatureVault(): SignatureVault {
  const [signatures, setSignatures] = useState<StoredSignature[]>([]);

  useEffect(() => {
    let cancelled = false;
    repo
      .listSignatures()
      .then((list) => {
        if (!cancelled) setSignatures(list);
      })
      .catch((err: unknown) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  const nextName = useCallback((): string => {
    const highest = signatures.reduce(
      (max, s) => Math.max(max, Number(NUMBERED.exec(s.name)?.[1] ?? 0)),
      0,
    );
    return `Signature ${Math.max(highest, signatures.length) + 1}`;
  }, [signatures]);

  const save = useCallback(async (name: string, png: Uint8Array): Promise<boolean> => {
    try {
      const saved = await repo.saveSignature(name, png);
      setSignatures((prev) => [saved, ...prev]);
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save that signature");
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      await repo.deleteSignature(id);
      setSignatures((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete that signature");
    }
  }, []);

  return { signatures, nextName, save, remove };
}
