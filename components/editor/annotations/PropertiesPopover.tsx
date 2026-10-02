"use client";

import { Signature, Trash2 } from "lucide-react";
import {
  HIGHLIGHT_PRESETS,
  INK_PRESETS,
  parseHex,
  rgbToHex,
  type Preset,
} from "@/components/editor/annotations/presets";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  AnnotationKind,
  type Annotation,
  type RGB,
} from "@/lib/annotations/types";
import type { PageId } from "@/lib/pdf/types";
import { editorStore, type ToolSettingKey } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";

interface Field {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Shown beside the slider; percentages read better than 0.35. */
  format(v: number): string;
  patch(v: number): Partial<Annotation>;
  setting: ToolSettingKey | null;
}

interface Spec {
  presets: Preset[] | null;
  hex: string;
  colorPatch(c: RGB): Partial<Annotation>;
  colorSetting: ToolSettingKey | null;
  field: Field | null;
}

const round = (v: number): string => String(Math.round(v * 10) / 10);

function specOf(a: Annotation): Spec {
  switch (a.kind) {
    case AnnotationKind.Text:
      return {
        presets: INK_PRESETS,
        hex: rgbToHex(a.color),
        colorPatch: (color) => ({ color }),
        colorSetting: "textColor",
        field: {
          label: "Text size",
          min: 6,
          max: 72,
          step: 1,
          value: a.fontSize,
          format: round,
          patch: (fontSize) => ({ fontSize }),
          setting: "fontSize",
        },
      };
    case AnnotationKind.Ink:
      return {
        presets: INK_PRESETS,
        hex: rgbToHex(a.color),
        colorPatch: (color) => ({ color }),
        colorSetting: "penColor",
        field: {
          label: "Stroke",
          min: 1,
          max: 24,
          step: 1,
          value: a.size,
          format: round,
          patch: (size) => ({ size }),
          setting: "penSize",
        },
      };
    case AnnotationKind.Highlight:
      return {
        presets: HIGHLIGHT_PRESETS,
        hex: rgbToHex(a.color),
        colorPatch: (color) => ({ color }),
        colorSetting: "highlightColor",
        field: {
          label: "Opacity",
          min: 0.05,
          max: 1,
          step: 0.05,
          value: a.opacity,
          format: (v) => `${Math.round(v * 100)}%`,
          patch: (opacity) => ({ opacity }),
          setting: null,
        },
      };
    case AnnotationKind.Rect:
      return {
        presets: INK_PRESETS,
        hex: rgbToHex(a.strokeColor),
        colorPatch: (strokeColor) => ({ strokeColor }),
        colorSetting: "penColor",
        field: {
          label: "Stroke",
          min: 0.5,
          max: 12,
          step: 0.5,
          value: a.strokeWidth,
          format: round,
          patch: (strokeWidth) => ({ strokeWidth }),
          setting: null,
        },
      };
    case AnnotationKind.Image:
      return {
        presets: null,
        hex: "#000000",
        colorPatch: () => ({}),
        colorSetting: null,
        field: null,
      };
  }
}

interface PropertiesPopoverProps {
  pageId: PageId;
  annotation: Annotation;
  /** The selection's top-centre, in CSS pixels local to the layer. */
  anchor: { x: number; y: number };
  onSaveSignature?(png: Uint8Array): void;
}

export function PropertiesPopover({
  pageId,
  annotation,
  anchor,
  onSaveSignature,
}: PropertiesPopoverProps) {
  const spec = specOf(annotation);

  const apply = (patch: Partial<Annotation>, transient = false): void => {
    workspaceStore
      .getState()
      .updateAnnotation(pageId, annotation.id, patch, transient ? { transient: true } : undefined);
  };

  const pickColor = (hex: string): void => {
    const color = parseHex(hex);
    if (color === null) return;
    apply(spec.colorPatch(color));
    if (spec.colorSetting !== null) {
      editorStore.getState().setToolSetting(spec.colorSetting, color);
    }
  };

  const remove = (): void => {
    workspaceStore.getState().removeAnnotation(pageId, annotation.id);
    editorStore.getState().setSelectedAnnotation(null);
  };

  return (
    <Popover open>
      <PopoverAnchor asChild>
        <span
          aria-hidden
          className="absolute"
          style={{ left: anchor.x, top: anchor.y, width: 1, height: 1 }}
        />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={14}
        data-slot="annotation-properties"
        aria-label="Annotation properties"
        className="pointer-events-auto w-auto min-w-60 p-2.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {spec.presets === null ? null : (
          <div className="flex items-center gap-1.5" role="group" aria-label="Color">
            {spec.presets.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                aria-label={preset.name}
                aria-pressed={preset.hex.toLowerCase() === spec.hex.toLowerCase()}
                onClick={() => pickColor(preset.hex)}
                style={{ background: preset.hex }}
                className="size-6 rounded-full ring-1 ring-border transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface-raised"
              />
            ))}
            <label
              className="relative ml-auto size-6 shrink-0 rounded-full ring-1 ring-border"
              style={{
                background: "conic-gradient(#d4212d,#ffdf50,#1d7d3e,#90d7ff,#5c2f95,#d4212d)",
              }}
            >
              <input
                type="color"
                aria-label="Custom color"
                value={spec.hex}
                onChange={(e) => pickColor(e.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        )}

        {spec.field === null ? null : (
          <div className="mt-3 flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-foreground-muted">{spec.field.label}</span>
            <Slider
              aria-label={spec.field.label}
              min={spec.field.min}
              max={spec.field.max}
              step={spec.field.step}
              value={[spec.field.value]}
              onValueChange={([v]) => spec.field !== null && apply(spec.field.patch(v), true)}
              onValueCommit={([v]) => {
                if (spec.field === null) return;
                apply(spec.field.patch(v));
                if (spec.field.setting !== null) {
                  editorStore.getState().setToolSetting(spec.field.setting, v);
                }
              }}
            />
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-foreground-muted">
              {spec.field.format(spec.field.value)}
            </span>
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-1 border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-danger hover:bg-danger/10 hover:text-danger"
            onClick={remove}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          {annotation.kind === AnnotationKind.Image && onSaveSignature !== undefined ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2"
              onClick={() => onSaveSignature(annotation.png)}
            >
              <Signature className="size-3.5" />
              Save as signature
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
