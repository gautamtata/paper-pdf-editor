"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { INK_PRESETS } from "@/components/editor/annotations/presets";
import { SignaturePad, type SignaturePadHandle } from "@/components/editor/SignaturePad";
import { SignatureTyped } from "@/components/editor/SignatureTyped";
import { SignatureUpload } from "@/components/editor/SignatureUpload";
import { SignatureVault } from "@/components/editor/SignatureVault";
import type { SignatureVault as Vault } from "@/components/editor/useSignatureVault";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hexToRgb, type RGB } from "@/lib/annotations/types";
import { fileToTransparentPng, pngAspect, type SignatureImage } from "@/lib/signature/image";
import { svgToPng, typedSignatureSvg } from "@/lib/signature/typed";
import type { StoredSignature } from "@/lib/storage/repo";

type Tab = "draw" | "type" | "upload";

const TABS: { value: Tab; label: string }[] = [
  { value: "draw", label: "Draw" },
  { value: "type", label: "Type" },
  { value: "upload", label: "Upload" },
];

/** The ink a signature is made in by default: a blue-black fountain-pen tone. */
const DEFAULT_INK = INK_PRESETS[0];

const message = (err: unknown): string =>
  err instanceof Error ? err.message : "Couldn't make that signature";

interface SigningFormProps {
  vault: Vault;
  onPlace(png: Uint8Array, aspect: number): void;
  onDone(): void;
}

/** Mounted with the dialog, so every signing session starts on a clean pad. */
function SigningForm({ vault, onPlace, onDone }: SigningFormProps) {
  const [tab, setTab] = useState<Tab>("draw");
  const [hex, setHex] = useState(DEFAULT_INK.hex);
  const [color, setColor] = useState<RGB>(() => hexToRgb(DEFAULT_INK.hex));
  const [text, setText] = useState("");
  const [upload, setUpload] = useState<SignatureImage | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [keep, setKeep] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  const ready = tab === "draw" ? hasInk : tab === "type" ? text.trim() !== "" : upload !== null;

  const pickInk = (value: string): void => {
    setHex(value);
    setColor(hexToRgb(value));
  };

  const render = async (): Promise<SignatureImage | null> => {
    if (tab === "draw") return (await pad.current?.exportPng()) ?? null;
    if (tab === "type") return svgToPng(typedSignatureSvg(text.trim(), color));
    return upload;
  };

  const place = async (): Promise<void> => {
    setBusy(true);
    try {
      const image = await render();
      if (image === null) return;
      // A vault that refuses the signature has said so already; the placement still stands.
      if (keep) await vault.save(name.trim() === "" ? vault.nextName() : name.trim(), image.png);
      onPlace(image.png, image.aspect);
      onDone();
    } catch (err) {
      console.error(err);
      toast.error(message(err));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File): Promise<void> => {
    setBusy(true);
    setUpload(null);
    try {
      setUpload(await fileToTransparentPng(file));
    } catch (err) {
      console.error(err);
      toast.error(message(err));
    } finally {
      setBusy(false);
    }
  };

  const placeSaved = async (signature: StoredSignature): Promise<void> => {
    setBusy(true);
    try {
      onPlace(signature.png, await pngAspect(signature.png));
      onDone();
    } catch (err) {
      console.error(err);
      toast.error(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <TabsList aria-label="How to sign">
            {TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value} data-testid={`signature-tab-${value}`}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tab === "upload" ? null : (
            <div className="flex items-center gap-1.5" role="group" aria-label="Ink">
              {INK_PRESETS.slice(0, 5).map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  aria-label={preset.name}
                  aria-pressed={preset.hex === hex}
                  onClick={() => pickInk(preset.hex)}
                  style={{ background: preset.hex }}
                  className="size-5 rounded-full ring-1 ring-border transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface-raised"
                />
              ))}
            </div>
          )}
        </div>

        {/* Mounted even while another tab shows, so a half-drawn signature survives a look at
            the other two: the pad repaints from its own strokes when it comes back. */}
        <TabsContent value="draw" forceMount>
          <SignaturePad ref={pad} color={color} onInkChange={setHasInk} />
        </TabsContent>
        <TabsContent value="type">
          <SignatureTyped text={text} color={color} onTextChange={setText} />
        </TabsContent>
        <TabsContent value="upload">
          <SignatureUpload image={upload} busy={busy} onPick={(file) => void pickFile(file)} />
        </TabsContent>
      </Tabs>

      <SignatureVault
        signatures={vault.signatures}
        busy={busy}
        onPick={(signature) => void placeSaved(signature)}
        onDelete={(id) => void vault.remove(id)}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <input
            type="checkbox"
            checked={keep}
            onChange={(e) => setKeep(e.target.checked)}
            className="size-4 rounded-xs accent-accent"
          />
          Save to my signatures
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          disabled={!keep}
          aria-label="Signature name"
          placeholder={vault.nextName()}
          className="h-8 w-36 text-[0.8125rem]"
        />
        <Button
          className="ml-auto"
          disabled={!ready || busy}
          onClick={() => void place()}
          data-testid="place-signature"
        >
          {busy ? "Working…" : "Place"}
        </Button>
      </div>
    </>
  );
}

interface SignatureDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  vault: Vault;
  onPlace(png: Uint8Array, aspect: number): void;
}

export function SignatureDialog({ open, onOpenChange, vault, onPlace }: SignatureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="signature-dialog">
        <DialogHeader>
          <DialogTitle>Sign this document</DialogTitle>
          <DialogDescription>
            Draw it, type it, or photograph one you signed on paper.
          </DialogDescription>
        </DialogHeader>
        <SigningForm vault={vault} onPlace={onPlace} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
