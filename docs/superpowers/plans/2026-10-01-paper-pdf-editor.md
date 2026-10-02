# Paper PDF Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-first, in-browser PDF editor (open, merge, delete/reorder/rotate pages, annotate, sign, export) with zero server-side data.

**Architecture:** A pure "virtual page" engine (`lib/pdf`) edits an ordered list of page pointers; pdf-lib only writes bytes at export, where annotations are flattened. pdf.js renders pages to canvases through its own worker. A Zustand store with snapshot undo/redo drives a React UI; Dexie persists sources, workspaces and signatures in IndexedDB.

**Tech Stack:** Next.js 16.3.8 (App Router, Turbopack), React 19, TypeScript strict, Tailwind 4, pdf-lib 1.17, pdfjs-dist 6.3, @dnd-kit, perfect-freehand, zustand 5, dexie 4, vitest 5, @playwright/test 1.63, Bun.

**Spec:** `docs/superpowers/specs/2026-10-01-paper-pdf-editor-design.md`

## Global Constraints

- Package manager is **Bun** (`bun add`, `bun run`, `bunx`). Never commit `package-lock.json`.
- **No route handlers, server actions, or API routes that accept file bytes.** The only server code is static rendering of pages. Grep `app/` for `route.ts` and `"use server"` must be empty.
- All PDF/annotation geometry is stored in **PDF user space (points, y-up, relative to the unrotated source page)**.
- TypeScript `strict`; no `any` except in explicitly typed third-party shims. Enums for states (`Rotation`, `Tool`, `AnnotationKind`).
- Files stay focused: aim < 300 lines per file; split when larger.
- Minimal comments: only non-obvious constraints.
- Every task ends with `bun run lint && bunx tsc --noEmit && bun run test` green, then a commit.
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/01-app/01-getting-started/*.md` for anything touching `app/`. Notably: `middleware.ts` is `proxy.ts`; `params` is a Promise in pages; client components need `"use client"`.
- Import alias `@/*` → repo root (`@/lib/pdf/ops`).
- pdfjs-dist 6 is ESM-only. Its API types live in `node_modules/pdfjs-dist/types/src/display/api.d.ts`; read them before use.
- Dev server policy: tests that need a server use Playwright's `webServer` config; kill any manually started server before finishing a task.

---

## File map

| Path | Responsibility |
|---|---|
| `lib/pdf/types.ts` | `Rotation`, `SourceDoc`, `VirtualPage`, `Workspace`, `PageSize`, id helpers |
| `lib/pdf/load.ts` | `loadSource(name, bytes)`; rejects encrypted/malformed |
| `lib/pdf/ops.ts` | pure page-list operations |
| `lib/pdf/export.ts` | `exportWorkspace(ws, onProgress)` → `Uint8Array` |
| `lib/annotations/types.ts` | `AnnotationKind`, `Annotation` union, factories |
| `lib/annotations/geometry.ts` | matrix helpers, rect math, hit testing |
| `lib/annotations/ink.ts` | points → outline polygon → SVG path |
| `lib/annotations/flatten.ts` | draw annotations onto a pdf-lib page |
| `lib/render/pdfjs.ts` | pdf.js singleton + worker config, `getDocument` cache |
| `lib/render/renderer.ts` | `renderPage(source, index, rotation, scale)` → `HTMLCanvasElement`, LRU cache |
| `lib/storage/db.ts` | Dexie schema |
| `lib/storage/repo.ts` | typed CRUD, quota fallback, `clearAll` |
| `lib/store/workspace.ts` | Zustand workspace store, snapshot undo/redo, autosave |
| `lib/store/editor.ts` | selection, active tool, zoom, tool settings |
| `lib/utils.ts` | `cn`, `downloadBytes`, `formatBytes` |
| `test/fixtures.ts` | `makePdf(pageCount, label)` and friends |
| `components/ui/*` | shadcn-style primitives (button, dialog, popover, tooltip, dropdown, kbd) |
| `components/home/DropZone.tsx`, `RecentList.tsx` | home page |
| `components/editor/EditorShell.tsx` | layout + loading + shortcuts |
| `components/editor/ThumbnailRail.tsx`, `ThumbnailCard.tsx` | sortable page grid |
| `components/editor/PageViewer.tsx`, `PageView.tsx` | continuous viewer, lazy render |
| `components/editor/AnnotationLayer.tsx`, `annotations/*.tsx` | SVG overlay + per-kind shapes + tool handlers |
| `components/editor/Toolbar.tsx`, `PropertiesPopover.tsx`, `CommandPalette.tsx` | chrome |
| `components/editor/SignatureDialog.tsx`, `SignaturePad.tsx` | signature capture + vault |
| `components/editor/ExportButton.tsx` | export flow |
| `app/page.tsx`, `app/edit/[workspaceId]/page.tsx`, `app/layout.tsx`, `app/globals.css` | routes + theme |
| `scripts/copy-pdf-worker.mjs` | copies pdf.js worker into `public/` |
| `e2e/editor.spec.ts`, `playwright.config.ts` | end-to-end proof |

Risk labels for the Boss process: tasks marked **[HIGH-RISK]** get Fable implementer + Fable reviewer; others Opus/Opus.

---

### Task 1: Project foundation (deps, test runner, theme, UI primitives)

**Files:**
- Modify: `package.json`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (placeholder), `.gitignore`
- Create: `vitest.config.ts`, `lib/utils.ts`, `test/smoke.test.ts`, `components/ui/button.tsx`, `components/ui/dialog.tsx`, `components/ui/popover.tsx`, `components/ui/tooltip.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/kbd.tsx`, `components/ui/slider.tsx`, `components/ui/input.tsx`, `components/theme-provider.tsx`? (no — use CSS `prefers-color-scheme` only; no provider)

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`; `downloadBytes(bytes: Uint8Array, filename: string): void`; `formatBytes(n: number): string`; UI primitives with shadcn-compatible props.

- [ ] **Step 1: Install dependencies**

```bash
bun add pdf-lib@1.17.1 pdfjs-dist@6.3.289 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 perfect-freehand@1.2.3 zustand@5.0.15 dexie@4.4.6 motion@13.5.0 lucide-react@1.49.0 clsx@2.1.1 tailwind-merge@3.7.0 class-variance-authority@0.7.1 radix-ui@1.6.7 cmdk@1.1.1 sonner@2.0.8 nanoid@6.0.1 @fontsource-variable/caveat@5.3.0
bun add -d vitest@5.0.3 @vitejs/plugin-react@6.1.1 jsdom@30.1.1 fake-indexeddb@6.2.5 @playwright/test@1.63.0 @testing-library/react @testing-library/dom
```

- [ ] **Step 2: Scripts and vitest config**

`package.json` scripts:
```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint",
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test",
"typecheck": "tsc --noEmit"
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "components/**/*.test.tsx", "test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```
`test/setup.ts` contains `import "fake-indexeddb/auto";`.

- [ ] **Step 3: Write failing smoke test** — `test/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cn, formatBytes } from "@/lib/utils";
describe("utils", () => {
  it("merges tailwind classes", () => { expect(cn("p-2", "p-4")).toBe("p-4"); });
  it("formats bytes", () => { expect(formatBytes(1536)).toBe("1.5 KB"); expect(formatBytes(0)).toBe("0 B"); });
});
```
Run `bun run test` → fails (module not found).

- [ ] **Step 4: Implement `lib/utils.ts`**
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}
export function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```
Run test → passes.

- [ ] **Step 5: Theme + layout.** `app/globals.css` — Tailwind 4 with `@theme` tokens using oklch warm neutrals (paper). Define: `--color-paper-{50..950}`, `--color-accent` (deep ink blue, e.g. `oklch(0.45 0.12 260)`), `--radius: 0.5rem`, dark overrides under `@media (prefers-color-scheme: dark)`; `body { background: var(--color-paper-50); color: var(--color-paper-900) }`. `app/layout.tsx`: Geist Sans + Geist Mono via `next/font/google` (`Geist`, `Geist_Mono`) exposed as CSS vars, `import "@fontsource-variable/caveat"`, `<Toaster />` from sonner, `metadata = { title: "Paper", description: "A private, local-first PDF editor" }`. Replace `app/page.tsx` with a minimal placeholder `<main>Paper</main>` (Task 9 replaces it).

- [ ] **Step 6: UI primitives.** Hand-write shadcn-style components over the `radix-ui` umbrella package: `Button` (variants: default, secondary, ghost, outline, destructive; sizes: sm, md, lg, icon), `Dialog`, `Popover`, `Tooltip` (with `TooltipProvider` in layout), `DropdownMenu`, `Slider`, `Input`, `Kbd`. Use `cn` and `class-variance-authority`. Each file < 120 lines.

- [ ] **Step 7: Verify** `bun run lint && bun run typecheck && bun run test && bun run build` all green. Add `.gitignore` entries: `test-results/`, `playwright-report/`, `public/pdf.worker.min.mjs`.

- [ ] **Step 8: Commit** `feat: project foundation, theme, ui primitives, vitest`

---

### Task 2: PDF types, fixtures, and `loadSource`

**Files:**
- Create: `lib/pdf/types.ts`, `lib/pdf/load.ts`, `test/fixtures.ts`, `lib/pdf/load.test.ts`

**Interfaces:**
- Produces:
```ts
export enum Rotation { R0 = 0, R90 = 90, R180 = 180, R270 = 270 }
export type SourceId = string; export type PageId = string; export type WorkspaceId = string;
export interface PageSize { w: number; h: number }
export interface SourcePageInfo { size: PageSize; rotation: Rotation }   // intrinsic /Rotate of the source page
export interface SourceDoc { id: SourceId; name: string; bytes: Uint8Array; pageCount: number; pages: SourcePageInfo[] }
export interface VirtualPage { id: PageId; sourceId: SourceId | null; sourceIndex: number; rotation: Rotation; size: PageSize; annotations: Annotation[] }
export interface Workspace { id: WorkspaceId; name: string; sources: Record<SourceId, SourceDoc>; pages: VirtualPage[]; updatedAt: number }
export const newId = (): string => nanoid(10);
export const addRotation = (a: Rotation, b: Rotation): Rotation;   // modulo 360
export function pagesFromSource(src: SourceDoc): VirtualPage[];     // one VirtualPage per source page, rotation R0, [] annotations
export class PdfLoadError extends Error { constructor(public reason: "encrypted" | "malformed", public fileName: string) }
export async function loadSource(name: string, bytes: Uint8Array): Promise<SourceDoc>;
```
- `test/fixtures.ts`:
```ts
export async function makePdf(pageCount: number, label = "doc"): Promise<Uint8Array>
// page i (0-based) has width 400 + i and height 600, and the text `${label}-p${i}` drawn at (40, 560)
export async function makeEncryptedPdf(): Promise<Uint8Array>  // see note
export const GARBAGE = new TextEncoder().encode("not a pdf at all");
```
Note on encrypted fixture: pdf-lib cannot encrypt. Commit a tiny real encrypted PDF at `test/fixtures/encrypted.pdf` generated once with `qpdf` if available (`qpdf --encrypt a b 256 -- in.pdf out.pdf`) — if `qpdf` is not installed, create it with a 20-line script using `pdf-lib` to write a PDF whose trailer includes an `/Encrypt` dictionary reference (pdf-lib's parser throws `EncryptedPDFError` as soon as the trailer has `/Encrypt`). Either way, `makeEncryptedPdf()` reads that file. Verify in the test that `PDFDocument.load` on it throws `EncryptedPDFError`.

- [ ] **Step 1: Failing tests** — `lib/pdf/load.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadSource, PdfLoadError } from "@/lib/pdf/load";
import { Rotation, pagesFromSource } from "@/lib/pdf/types";
import { makePdf, makeEncryptedPdf, GARBAGE } from "@/test/fixtures";

describe("loadSource", () => {
  it("parses page count and sizes", async () => {
    const src = await loadSource("a.pdf", await makePdf(3));
    expect(src.pageCount).toBe(3);
    expect(src.pages.map(p => p.size.w)).toEqual([400, 401, 402]);
    expect(src.pages[0].rotation).toBe(Rotation.R0);
    expect(src.name).toBe("a.pdf");
    expect(src.id).toHaveLength(10);
  });
  it("rejects encrypted", async () => {
    await expect(loadSource("e.pdf", await makeEncryptedPdf())).rejects.toMatchObject({ reason: "encrypted", fileName: "e.pdf" });
  });
  it("rejects garbage", async () => {
    await expect(loadSource("g.pdf", GARBAGE)).rejects.toBeInstanceOf(PdfLoadError);
    await expect(loadSource("g.pdf", GARBAGE)).rejects.toMatchObject({ reason: "malformed" });
  });
  it("pagesFromSource builds one virtual page per source page", async () => {
    const src = await loadSource("a.pdf", await makePdf(2));
    const pages = pagesFromSource(src);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toMatchObject({ sourceId: src.id, sourceIndex: 1, rotation: Rotation.R0, size: { w: 401, h: 600 }, annotations: [] });
    expect(new Set(pages.map(p => p.id)).size).toBe(2);
  });
});
```
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.** `load.ts`: `PDFDocument.load(bytes, { updateMetadata: false })`; catch `EncryptedPDFError` (exported from pdf-lib) → `PdfLoadError("encrypted")`; any other error → `"malformed"`. Read `getPages()` for `getSize()` and `getRotation().angle` (normalize to `Rotation`). `Annotation` type is imported from `@/lib/annotations/types` — create that file now with just the `Annotation` type placeholder? **No.** Task 4 owns it; to keep Task 2 compiling, define `export type Annotation = import("@/lib/annotations/types").Annotation` is impossible before the file exists. Instead Task 2 creates `lib/annotations/types.ts` containing only `export interface AnnotationBase { id: string }` and `export type Annotation = AnnotationBase;` — Task 4 replaces it with the full union.
- [ ] **Step 4: Run** → passes. Lint/typecheck green.
- [ ] **Step 5: Commit** `feat(pdf): types, fixtures, loadSource with encrypted/malformed rejection`

---

### Task 3: Pure page operations

**Files:**
- Create: `lib/pdf/ops.ts`, `lib/pdf/ops.test.ts`

**Interfaces:**
- Consumes: `VirtualPage`, `Rotation`, `addRotation`, `newId`, `pagesFromSource`, `SourceDoc`.
- Produces (all pure, never mutate input, return new arrays; unknown ids are ignored):
```ts
export function deletePages(pages: VirtualPage[], ids: Iterable<PageId>): VirtualPage[];
export function movePages(pages: VirtualPage[], ids: Iterable<PageId>, toIndex: number): VirtualPage[];
// removes the selected pages (keeping their relative order) and inserts them so the first selected page lands at `toIndex`
// where toIndex is measured against the array AFTER removal, clamped to [0, remaining.length]
export function rotatePages(pages: VirtualPage[], ids: Iterable<PageId>, delta: Rotation): VirtualPage[];
export function duplicatePages(pages: VirtualPage[], ids: Iterable<PageId>): VirtualPage[];
// each duplicate gets a new id, deep-copied annotations with new ids, inserted directly after its original
export function insertBlank(pages: VirtualPage[], atIndex: number, size: PageSize): VirtualPage[];  // sourceId null
export function appendSource(pages: VirtualPage[], src: SourceDoc, atIndex?: number): VirtualPage[];  // default end
export function extractPages(pages: VirtualPage[], ids: Iterable<PageId>): VirtualPage[]; // subset in current order, fresh ids
export function usedSourceIds(pages: VirtualPage[]): Set<SourceId>;
```

- [ ] **Step 1: Failing tests** — `lib/pdf/ops.test.ts`. Build pages with a helper `mk(n)` returning `n` pages with ids `p0..p{n-1}`, sourceId `s`, sourceIndex `i`:
```ts
const mk = (n: number): VirtualPage[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, sourceId: "s", sourceIndex: i, rotation: Rotation.R0, size: { w: 100, h: 100 }, annotations: [] }));
const ids = (p: VirtualPage[]) => p.map(x => x.id);
```
Tests (each `it` with a concrete assertion):
1. `deletePages(mk(5), ["p1","p3"])` → ids `["p0","p2","p4"]`; input unchanged (length 5).
2. `deletePages(mk(2), ["zzz"])` → unchanged ids.
3. `movePages(mk(5), ["p3","p4"], 0)` → `["p3","p4","p0","p1","p2"]`.
4. `movePages(mk(5), ["p0"], 4)` → `["p1","p2","p3","p4","p0"]` (toIndex beyond remaining clamps to end).
5. `movePages(mk(5), ["p1","p3"], 1)` → `["p0","p1","p3","p2","p4"]`.
6. `rotatePages(mk(1), ["p0"], Rotation.R270)` then again `R90` → `R0`; `rotatePages(..., R90)` once → `R90`.
7. `duplicatePages(mk(3), ["p1"])` → length 4, order `["p0","p1",<new>,"p2"]`, new id ≠ "p1", `sourceIndex` 1; annotations with id "a" on p1 become a copy with a different id.
8. `insertBlank(mk(2), 1, {w:612,h:792})` → length 3, `[1].sourceId === null`, size matches.
9. `appendSource(mk(1), srcWith2Pages)` → length 3, last two sourceId = src.id; `appendSource(mk(2), src, 1)` → inserted at 1.
10. `extractPages(mk(4), ["p3","p1"])` → sourceIndex order `[1,3]`, ids all new.
11. `usedSourceIds` returns `{"s"}` and excludes null sources.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** with `Set` lookups, `structuredClone` for annotations in duplicate/extract (then reassign ids).
- [ ] **Step 4: Run** → passes.
- [ ] **Step 5: Commit** `feat(pdf): pure page operations`

---

### Task 4: Annotation model, geometry, ink

**Files:**
- Replace: `lib/annotations/types.ts`
- Create: `lib/annotations/geometry.ts`, `lib/annotations/ink.ts`, tests for each.

**Interfaces:**
```ts
// types.ts
export enum AnnotationKind { Text = "text", Ink = "ink", Highlight = "highlight", Rect = "rect", Image = "image" }
export interface Rect { x: number; y: number; w: number; h: number }  // PDF space, (x,y) = bottom-left
export interface RGB { r: number; g: number; b: number }                 // 0..1
interface Base { id: string; kind: AnnotationKind }
export interface TextAnnotation extends Base { kind: AnnotationKind.Text; rect: Rect; fontSize: number; color: RGB; content: string }
export interface InkAnnotation extends Base { kind: AnnotationKind.Ink; strokes: InkPoint[][]; color: RGB; size: number }
export interface InkPoint { x: number; y: number; p: number }  // p = pressure 0..1
export interface HighlightAnnotation extends Base { kind: AnnotationKind.Highlight; rect: Rect; color: RGB; opacity: number }
export interface RectAnnotation extends Base { kind: AnnotationKind.Rect; rect: Rect; strokeColor: RGB; strokeWidth: number; fill: RGB | null }
export interface ImageAnnotation extends Base { kind: AnnotationKind.Image; rect: Rect; png: Uint8Array; aspect: number }
export type Annotation = TextAnnotation | InkAnnotation | HighlightAnnotation | RectAnnotation | ImageAnnotation;
export const createText = (rect: Rect, opts?: Partial<Omit<TextAnnotation,"id"|"kind"|"rect">>): TextAnnotation;   // defaults fontSize 14, black, ""
export const createInk = (strokes: InkPoint[][], color: RGB, size: number): InkAnnotation;
export const createHighlight = (rect: Rect, color?: RGB): HighlightAnnotation;  // default yellow {1,0.9,0.2}, opacity 0.35
export const createRect = (rect: Rect, opts?): RectAnnotation;                   // default stroke black 2, fill null
export const createImage = (rect: Rect, png: Uint8Array, aspect: number): ImageAnnotation;
export function annotationBounds(a: Annotation): Rect;   // ink: bbox of all points padded by size/2
export function translateAnnotation<A extends Annotation>(a: A, dx: number, dy: number): A;
export function resizeAnnotation<A extends Annotation>(a: A, rect: Rect): A;  // ink: scales points to fit rect; image keeps aspect by adjusting h
export const rgbToCss = (c: RGB) => string; export const hexToRgb = (hex: string) => RGB;

// geometry.ts
export type Matrix = [number, number, number, number, number, number]; // pdf.js viewport.transform layout [a,b,c,d,e,f]
export const applyMatrix = (m: Matrix, x: number, y: number): [number, number];
export const invertMatrix = (m: Matrix) => Matrix;
export const matrixToCss = (m: Matrix) => string;  // "matrix(a,b,c,d,e,f)"
export const normalizeRect = (x1,y1,x2,y2) => Rect;   // any two corners → positive w/h
export const rectContains = (r: Rect, x: number, y: number) => boolean;
export const clampRect = (r: Rect, page: PageSize) => Rect;

// ink.ts
export function strokeToPath(points: InkPoint[], size: number): string;   // perfect-freehand getStroke({size, thinning:0.6, smoothing:0.5, streamline:0.5, simulatePressure: points.every(p=>p.p===0.5)}) → closed SVG path "M … Z" in the SAME coordinate space as the input points
export function strokeBounds(points: InkPoint[], size: number): Rect;
```

- [ ] **Step 1: Failing tests**
`lib/annotations/geometry.test.ts`:
```ts
it("applies and inverts a y-flip matrix like pdf.js at scale 2, rotation 0 on a 100x200 page", () => {
  const m: Matrix = [2, 0, 0, -2, 0, 400];
  expect(applyMatrix(m, 10, 20)).toEqual([20, 360]);
  const [x, y] = applyMatrix(invertMatrix(m), 20, 360); expect(x).toBeCloseTo(10); expect(y).toBeCloseTo(20);
});
it("normalizeRect from any corners", () => { expect(normalizeRect(5, 9, 1, 3)).toEqual({ x: 1, y: 3, w: 4, h: 6 }); });
it("clampRect keeps rect inside page", () => { expect(clampRect({ x: -5, y: 0, w: 50, h: 10 }, { w: 40, h: 40 })).toEqual({ x: 0, y: 0, w: 40, h: 10 }); });
```
`lib/annotations/ink.test.ts`:
```ts
it("produces a closed path and bounds that contain the points", () => {
  const pts = [{x:0,y:0,p:0.5},{x:10,y:5,p:0.5},{x:20,y:0,p:0.5}];
  const d = strokeToPath(pts, 4);
  expect(d.startsWith("M")).toBe(true); expect(d.trim().endsWith("Z")).toBe(true);
  const b = strokeBounds(pts, 4); expect(b.x).toBeLessThanOrEqual(0); expect(b.x + b.w).toBeGreaterThanOrEqual(20);
});
```
`lib/annotations/types.test.ts`: `annotationBounds` for rect kinds returns rect; for ink equals `strokeBounds` union; `translateAnnotation` moves rect/points; `resizeAnnotation` on image keeps `aspect` (`h === w / aspect`); `hexToRgb("#ff0000")` → `{r:1,g:0,b:0}`.
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** → passes.
- [ ] **Step 5: Commit** `feat(annotations): model, geometry, ink paths`

---

### Task 5: Flatten + export **[HIGH-RISK]** (pdf-lib coordinate correctness)

**Files:**
- Create: `lib/annotations/flatten.ts`, `lib/pdf/export.ts`, `lib/pdf/export.test.ts`, `lib/annotations/flatten.test.ts`

**Interfaces:**
```ts
// flatten.ts
export interface FlattenContext { doc: PDFDocument; font: PDFFont; imageCache: Map<string, PDFImage> } // imageCache keyed by annotation id
export async function flattenAnnotations(page: PDFPage, annotations: Annotation[], ctx: FlattenContext): Promise<void>;
// export.ts
export type ExportProgress = (done: number, total: number) => void;
export async function exportWorkspace(ws: Workspace, onProgress?: ExportProgress): Promise<Uint8Array>;
```
Behaviour:
- `exportWorkspace`: create `PDFDocument`, embed Helvetica once. Load each used source with `PDFDocument.load(bytes, { ignoreEncryption: false })` once (cache by sourceId). For each virtual page in order: blank → `doc.addPage([w,h])`; else `doc.copyPages(srcDoc, [sourceIndex])` **one page at a time in order** (simplicity over batching; batching is an optimization only if a test on 200 pages exceeds 3 s). Set `page.setRotation(degrees(addRotation(src.pages[i].rotation, vp.rotation)))`. Then `flattenAnnotations`. Call `onProgress(i+1, total)`. Return `doc.save({ useObjectStreams: true })`.
- `flattenAnnotations` draws in PDF user space of the unrotated page (pdf-lib's drawing ops already operate in unrotated user space, so no extra transform is needed — verify by test 4 below):
  - text: `page.drawText(content, { x: rect.x, y: rect.y + rect.h - fontSize, size: fontSize, font, color: rgb(...), maxWidth: rect.w, lineHeight: fontSize * 1.25 })`
  - highlight: `drawRectangle({ ...rect, color, opacity, blendMode: BlendMode.Multiply })`
  - rect: `drawRectangle({ ...rect, borderColor, borderWidth, color: fill ?? undefined })`
  - image: `ctx.imageCache` or `doc.embedPng(png)`; `drawImage(img, rect)`
  - ink: for each stroke `strokeToPath(points, size)` with points converted to SVG space `(x, pageH - y)`; `page.drawSvgPath(d, { x: 0, y: pageH, color, borderWidth: 0 })` (pdf-lib SVG paths are y-down from the given origin).

- [ ] **Step 1: Failing tests** — `lib/pdf/export.test.ts`:
```ts
import { PDFDocument, PDFName } from "pdf-lib";
async function wsFrom(...docs: [string, number][]): Promise<Workspace> { /* loadSource each, pagesFromSource, concat */ }
it("merges two 5-page docs into 10 pages in order", async () => {
  const ws = await wsFrom(["a",5],["b",5]);
  const out = await PDFDocument.load(await exportWorkspace(ws));
  expect(out.getPageCount()).toBe(10);
  expect(out.getPages().map(p => p.getWidth())).toEqual([400,401,402,403,404,400,401,402,403,404]);
});
it("deletes and reorders", async () => {
  const ws = await wsFrom(["a",5]);
  ws.pages = movePages(deletePages(ws.pages, [ws.pages[1].id, ws.pages[3].id]), [ws.pages[4].id], 0);
  const out = await PDFDocument.load(await exportWorkspace(ws));
  expect(out.getPages().map(p => p.getWidth())).toEqual([404,400,402]);
});
it("applies rotation and preserves source rotation", async () => {
  // fixture page already rotated 90 via setRotation in a custom fixture; virtual R90 → output 180
});
it("inserts blank pages", ...);  // width/height 612x792, no content
it("reports progress", async () => { const calls: number[] = []; await exportWorkspace(ws, (d) => calls.push(d)); expect(calls.at(-1)).toBe(ws.pages.length); });
it("round-trips: exporting the export of a merged doc gives the same sizes", ...);
```
`lib/annotations/flatten.test.ts`:
```ts
it("draws an image XObject for image annotations", async () => {
  const doc = await PDFDocument.create(); const page = doc.addPage([400,600]); const font = await doc.embedFont(StandardFonts.Helvetica);
  await flattenAnnotations(page, [createImage({x:10,y:10,w:100,h:50}, TINY_PNG, 2)], { doc, font, imageCache: new Map() });
  const xobj = page.node.Resources()?.lookup(PDFName.of("XObject"));
  expect(xobj).toBeDefined(); expect(xobj!.toString()).toContain("Image");
});
it("writes text, rect, highlight and ink into the content stream", async () => {
  // after flatten, decode page content: doc.context.lookup(page.node.Contents()) → PDFStream; get string;
  // assert it contains "Tj" (text), "re" (rect), "/Multiply" via ExtGState lookup, and " c " or " l " ops for the ink path.
});
```
`TINY_PNG` = a 1x1 PNG byte array literal (base64 `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`) placed in `test/fixtures.ts`.
- [ ] **Step 2: Run** → fails. **Step 3: Implement.** **Step 4: Run** → passes. Add a performance guard test: 200-page export under 5 s (skip in CI if env `CI`).
- [ ] **Step 5: Live proof.** Write a throwaway script `scratch/export-demo.ts` that builds a workspace with one rotated page, one signature image and ink, exports to `/tmp/paper-demo.pdf`, then render it with pdf.js (or open with `qlmanage -p` / `open`) and visually confirm the signature sits where expected (bottom-left origin). Report the observation. Delete the script before commit.
- [ ] **Step 6: Commit** `feat(pdf): export with annotation flattening`

---

### Task 6: IndexedDB persistence

**Files:**
- Create: `lib/storage/db.ts`, `lib/storage/repo.ts`, `lib/storage/repo.test.ts`

**Interfaces:**
```ts
// db.ts
export interface SourceRecord { id: string; name: string; bytes: Blob; pageCount: number; pages: SourcePageInfo[] }
export interface WorkspaceRecord { id: string; name: string; pages: VirtualPage[]; sourceIds: string[]; updatedAt: number; thumbnail?: string /* data URL */ }
export interface SignatureRecord { id: string; name: string; png: Blob; createdAt: number }
export class PaperDB extends Dexie { sources!: Table<SourceRecord,string>; workspaces!: Table<WorkspaceRecord,string>; signatures!: Table<SignatureRecord,string>; }
export const db: PaperDB;   // version(1).stores({ sources: "id", workspaces: "id, updatedAt", signatures: "id, createdAt" })

// repo.ts
export interface WorkspaceSummary { id: string; name: string; pageCount: number; updatedAt: number; thumbnail?: string }
export interface StoredSignature { id: string; name: string; png: Uint8Array; createdAt: number }
export const repo: {
  saveWorkspace(ws: Workspace, thumbnail?: string): Promise<void>;  // writes sources not yet present + workspace record; ImageAnnotation.png stays inline in pages JSON
  getWorkspace(id: string): Promise<Workspace | undefined>;          // rehydrates sources bytes (Blob → Uint8Array)
  listWorkspaces(): Promise<WorkspaceSummary[]>;                      // newest first
  deleteWorkspace(id: string): Promise<void>;                        // also deletes sources no other workspace references
  saveSignature(name: string, png: Uint8Array): Promise<StoredSignature>;
  listSignatures(): Promise<StoredSignature[]>;
  deleteSignature(id: string): Promise<void>;
  clearAll(): Promise<void>;
  isMemoryOnly(): boolean;        // true after a QuotaExceededError flipped the repo into in-memory mode
  onModeChange(cb: (memoryOnly: boolean) => void): () => void;
};
```
Memory-only mode: a private `Map`-backed implementation of the same operations; on any Dexie write throwing an error whose `name` is `"QuotaExceededError"` (or Dexie's `QuotaExceededError`), copy what is readable into memory, flip the flag, notify, and retry the write in memory.

- [ ] **Step 1: Failing tests** (`fake-indexeddb/auto` is in setup): save/get round trip preserves bytes and annotations incl. `png` `Uint8Array`; `listWorkspaces` ordering and pageCount; `deleteWorkspace` removes orphan sources but keeps shared ones; signatures CRUD; `clearAll` empties all tables; quota fallback: stub `db.workspaces.put` to throw `Object.assign(new Error("full"), { name: "QuotaExceededError" })` → `saveWorkspace` resolves, `isMemoryOnly()` is true, `getWorkspace` returns it, callback fired with `true`.
- [ ] **Step 2–4: Run/implement/run.**
- [ ] **Step 5: Commit** `feat(storage): dexie repo with quota fallback`

---

### Task 7: Stores (workspace with undo/redo + autosave, editor state)

**Files:**
- Create: `lib/store/workspace.ts`, `lib/store/editor.ts`, `lib/store/workspace.test.ts`, `lib/store/editor.test.ts`

**Interfaces:**
```ts
// workspace.ts  (zustand, vanilla-compatible: export both `workspaceStore` (createStore) and `useWorkspace` hook)
export interface WorkspaceState {
  workspace: Workspace | null;
  past: VirtualPage[][]; future: VirtualPage[][];   // snapshots; cap 100
  load(ws: Workspace): void;
  create(name: string, sources: SourceDoc[]): Workspace;      // builds pages via pagesFromSource, sets workspace, returns it
  addSources(sources: SourceDoc[], atIndex?: number): void;
  deletePages(ids: PageId[]): void; movePages(ids: PageId[], toIndex: number): void;
  rotatePages(ids: PageId[], delta: Rotation): void; duplicatePages(ids: PageId[]): void;
  insertBlank(atIndex: number, size: PageSize): void;
  extractToWorkspace(ids: PageId[], name: string): Workspace;  // returns a NEW workspace (not loaded); sources shared
  addAnnotation(pageId: PageId, a: Annotation): void;
  updateAnnotation(pageId: PageId, id: string, patch: Partial<Annotation>): void;
  removeAnnotation(pageId: PageId, id: string): void;
  rename(name: string): void;
  undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean;
}
export const workspaceStore: StoreApi<WorkspaceState>; export const useWorkspace: UseBoundStore<...>;
export function startAutosave(save: (ws: Workspace) => Promise<void>, debounceMs = 500): () => void;  // subscribes; returns unsubscribe; collapses rapid edits
export function selectPage(id: PageId): (s: WorkspaceState) => VirtualPage | undefined;

// editor.ts
export enum Tool { Select = "select", Text = "text", Pen = "pen", Highlight = "highlight", Rect = "rect", Signature = "signature" }
export interface EditorState {
  tool: Tool; setTool(t: Tool): void;
  selectedPageIds: Set<PageId>; selectPage(id: PageId, mode: "replace" | "toggle" | "range", order: PageId[]): void; selectAll(order: PageId[]): void; clearSelection(): void;
  activePageId: PageId | null; setActivePage(id: PageId | null): void;   // page most visible in viewer
  selectedAnnotation: { pageId: PageId; id: string } | null; setSelectedAnnotation(v): void;
  zoom: number; setZoom(z: number): void; zoomMode: "fit-width" | "fit-page" | "custom"; setZoomMode(m): void;  // zoom clamps 0.25..4
  penColor: RGB; penSize: number; textColor: RGB; fontSize: number; highlightColor: RGB; setToolSetting<K extends keyof EditorState>(k: K, v: EditorState[K]): void;
}
```
Every mutating page action pushes the previous `pages` onto `past`, clears `future`, bumps `updatedAt`. `updateAnnotation` during a drag would spam history: expose `updateAnnotation(pageId, id, patch, { transient?: boolean })` — transient updates do not push history; the final commit (pointer up) does.

- [ ] **Step 1: Failing tests** — workspace: create → 2 sources → 10 pages; deletePages then undo restores; redo reapplies; new action after undo clears future; history capped at 100; addAnnotation/update/remove and undo; transient update doesn't add history; `extractToWorkspace` leaves original untouched; `startAutosave` with `vi.useFakeTimers()` calls `save` once after 3 rapid edits and 500 ms. editor: range select with order; zoom clamp; `selectPage` toggle.
- [ ] **Step 2–4.** Note: zustand `create` works in node tests without React.
- [ ] **Step 5: Commit** `feat(store): workspace undo/redo + autosave, editor state`

---

### Task 8: pdf.js rendering **[HIGH-RISK]** (worker + Turbopack + cache)

**Files:**
- Create: `scripts/copy-pdf-worker.mjs`, `lib/render/pdfjs.ts`, `lib/render/renderer.ts`, `lib/render/renderer.test.ts`, modify `package.json` (`"predev"`, `"prebuild"`, `"postinstall"` → `node scripts/copy-pdf-worker.mjs`).

**Interfaces:**
```ts
// pdfjs.ts
export function getPdfjs(): Promise<typeof import("pdfjs-dist")>;   // dynamic import; sets GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs" once
export function getSourceDocument(src: SourceDoc): Promise<PDFDocumentProxy>;  // cached per src.id (Map); `releaseSource(id)` destroys
// renderer.ts
export interface RenderRequest { source: SourceDoc; pageIndex: number; rotation: Rotation; scale: number }  // rotation = TOTAL (intrinsic + virtual)
export interface Rendered { canvas: HTMLCanvasElement; width: number; height: number; transform: Matrix }  // transform = viewport.transform
export function renderPage(req: RenderRequest, signal?: AbortSignal): Promise<Rendered>;   // LRU cache (max 80 entries) keyed by `${id}:${pageIndex}:${rotation}:${scale.toFixed(3)}`; in-flight dedupe; rejects with DOMException AbortError
export function getViewportTransform(size: PageSize, intrinsic: Rotation, virtual: Rotation, scale: number): Matrix;  // pure; mirrors pdf.js PageViewport math so the overlay can be positioned before the render resolves
export function clearRenderCache(sourceId?: string): void;
```
`getViewportTransform` must equal `page.getViewport({scale, rotation}).transform` for all four rotations — the test asserts this against real pdf.js (run with `// @vitest-environment jsdom` and `canvas` absent: only compare the transform, do not render).

- [ ] **Step 1:** worker copy script: copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` → `public/pdf.worker.min.mjs` (mkdir -p). Run it. Confirm file exists.
- [ ] **Step 2: Failing test** `renderer.test.ts` (jsdom): `getViewportTransform({w:400,h:600}, R0, R90, 1.5)` equals pdf.js viewport transform for the first page of `makePdf(1)` with rotation 90 (load via `getDocument({ data, disableWorker: true })` — note in pdfjs 6 use `isEvalSupported:false` and `useWorkerFetch:false` if needed; read the typings). LRU test: mock `renderPage` internals by injecting a fake `draw` function via an exported `_setDrawForTests`; assert cache hit returns the same canvas object and eviction after 81 inserts.
- [ ] **Step 3: Implement.** Render with `page.render({ canvasContext, viewport, canvas })` per the pdfjs 6 typings; `devicePixelRatio` handled by the caller passing a scale that already includes DPR (renderer is DPR-agnostic).
- [ ] **Step 4: Live proof.** Temporary page `app/_render-proof/page.tsx` that loads a fixture PDF from `public/` and renders page 1 to a canvas; run `bun run dev`, open in a browser (use Playwright `bunx playwright screenshot` or the `run` skill), screenshot and confirm pixels are non-blank and no console error about the worker. Delete the proof page, kill the dev server.
- [ ] **Step 5: Commit** `feat(render): pdf.js worker setup, renderer with LRU`

---

### Task 9: Home page (drop zone, recents, create workspace)

**Files:**
- Create: `components/home/DropZone.tsx`, `components/home/RecentList.tsx`, `components/home/useOpenFiles.ts`, `components/home/DropZone.test.tsx`
- Replace: `app/page.tsx`

**Interfaces:**
- `useOpenFiles(): { open(files: File[]): Promise<void>; busy: boolean }` — for each file: `loadSource(file.name, new Uint8Array(await file.arrayBuffer()))`; on `PdfLoadError` show `toast.error` ("<name> is password protected" / "Couldn't read <name>"); with ≥1 success: `workspaceStore.getState().create(nameFrom(files), sources)`, `await repo.saveWorkspace(ws)`, `router.push(`/edit/${ws.id}`)`. `nameFrom`: single file → name without `.pdf`; multiple → `"<first> + N more"`.
- `DropZone({ onFiles })`: full-bleed drop target with `<input type="file" accept="application/pdf" multiple data-testid="file-input">`, drag-over state, paste handler (`document` paste with files), keyboard-accessible button "Choose PDFs". Shows file count toast on invalid types.
- `RecentList()`: `repo.listWorkspaces()` on mount; cards with thumbnail (or placeholder), name, page count, relative time; click → `/edit/:id`; trash icon → delete with `toast` undo not required (confirm via `DropdownMenu` item "Delete"). Footer link "Clear all local data" → `repo.clearAll()` + toast.
- `app/page.tsx` is a server component rendering `<HomeClient />` (client) with headline "Paper", subhead "A private PDF editor. Your files never leave this device.".

- [ ] **Step 1: Failing component test** (jsdom): rendering `DropZone` and firing `change` on `file-input` with two `File`s calls `onFiles` with both; dropping a non-PDF calls `onFiles` with `[]`.
- [ ] **Step 2–4.** Design: generous whitespace, dashed border that animates to solid accent on drag-over with `motion`, Lucide `FileUp` icon.
- [ ] **Step 5: Manual proof** — `bun run dev`, drop two PDFs, land on `/edit/<id>` (Task 10 page may still be a stub showing the workspace name and page count — add that stub here: `app/edit/[workspaceId]/page.tsx` awaiting `params`, rendering `<EditorShell workspaceId>` which for now loads the workspace and prints `name · N pages`). Kill server.
- [ ] **Step 6: Commit** `feat(home): drop zone, recents, workspace creation`

---

### Task 10: Editor shell, thumbnail rail, page viewer, toolbar, shortcuts

**Files:**
- Create: `components/editor/EditorShell.tsx`, `ThumbnailRail.tsx`, `ThumbnailCard.tsx`, `PageViewer.tsx`, `PageView.tsx`, `Toolbar.tsx`, `CommandPalette.tsx`, `useShortcuts.ts`, `useAutosaveThumbnail.ts`, `ThumbnailRail.test.tsx`, `useShortcuts.test.tsx`

**Interfaces / behaviour:**
- `EditorShell({ workspaceId })`: loads via `repo.getWorkspace`; missing → "Not found" + link home. Starts `startAutosave(ws => repo.saveWorkspace(ws, thumbnailRef.current))`. Layout: header (back, editable name via `Input`, page count, memory-only banner when `repo.isMemoryOnly()`), left rail (280 px, collapsible; < 900 px → bottom sheet toggled by a button), center viewer, floating bottom `Toolbar`.
- `ThumbnailRail`: `@dnd-kit/sortable` grid; each `ThumbnailCard` renders via `renderPage` at scale fitting 120 px width (includes DPR), shows index badge, rotation applied by the renderer (total rotation), selection ring, context `DropdownMenu` (Rotate left/right, Duplicate, Delete, Insert blank after, Extract selected). Click = replace, ⌘/Ctrl-click = toggle, Shift-click = range. Drag of a selected group moves all selected (`movePages(ids, overIndex)`). Dropping PDF files onto the rail calls `useOpenFiles`-like logic but `addSources(sources, atIndex)` into the current workspace (merge) and toasts "Added N pages".
- `PageViewer`: scroll container; each `PageView` is sized from `getViewportTransform` immediately (so layout doesn't jump), renders lazily via `IntersectionObserver` with 1 viewport of root margin, re-renders on zoom with a debounced 150 ms; `activePageId` is the page with the largest visible area. Zoom: ⌘+/−, ⌘0 fit-width, pinch (`wheel` with `ctrlKey`). `PageView` places `<AnnotationLayer>` (Task 11; until then render nothing) over the canvas.
- `Toolbar`: segmented tool buttons (Select V, Text T, Pen P, Highlight H, Rect R, Signature S) with tooltips + `Kbd`, divider, Add files, Undo/Redo, Export (Task 13 wires the real export; stub button disabled until then), zoom readout with popover (fit width / fit page / 50–200 %).
- `useShortcuts()`: `Delete`/`Backspace` → if annotation selected remove it else delete selected pages (toast "Deleted N pages" with Undo action); `⌘Z`/`⇧⌘Z`; `⌘A`; `R`/`⇧R` rotate selected; `⌘D` duplicate; `V T P H R S` tools; `Esc` → Select tool + clear annotation selection; `⌘E` export; `⌘K` palette. Ignore when focus is in an input/textarea/contenteditable.
- `CommandPalette` (`cmdk`): same actions as toolbar + "Extract selected pages to new document" (creates workspace via `extractToWorkspace`, saves, opens in new tab).

- [ ] **Step 1: Failing tests** — `ThumbnailRail.test.tsx` (jsdom, mock `@/lib/render/renderer` to return a blank canvas): renders N cards; click/shift-click selection updates `editorStore.selectedPageIds`; `useShortcuts.test.tsx`: pressing Delete with 2 pages selected removes them from the workspace store; pressing Delete while focused in an `<input>` does nothing.
- [ ] **Step 2–4.** 
- [ ] **Step 5: Manual proof** in a browser (dev server, then kill): open 2 PDFs, drag reorder, delete, rotate, undo, zoom, resize window below 900 px.
- [ ] **Step 6: Commit** `feat(editor): shell, thumbnail rail, viewer, toolbar, shortcuts`

---

### Task 11: Annotation layer and tools (text, pen, highlight, rect) + properties

**Files:**
- Create: `components/editor/AnnotationLayer.tsx`, `components/editor/annotations/TextShape.tsx`, `InkShape.tsx`, `RectShape.tsx` (used for rect + highlight + image frame), `ImageShape.tsx`, `SelectionHandles.tsx`, `useDrawTool.ts`, `PropertiesPopover.tsx`, `AnnotationLayer.test.tsx`

**Behaviour:**
- `AnnotationLayer({ page, transform, width, height })` is an `<svg>` absolutely covering the canvas; a `<g transform={matrixToCss(transform)}>` hosts shapes drawn in PDF space. Text is rendered via `<foreignObject>` with an inner `<div>` wrapped in `transform="translate(x, y+h) scale(1,-1)"` so it isn't mirrored; while editing it becomes a `contentEditable` div; blur commits `updateAnnotation`.
- Pointer handling by tool (all coordinates converted with `invertMatrix(transform)`):
  - Select: click shape → `setSelectedAnnotation`; drag → `translateAnnotation` (transient updates, commit on pointer up); handles → `resizeAnnotation`; click empty → clear.
  - Text: click → `createText({x,y-20,w:200,h:20})` and enter edit mode.
  - Pen: pointer down/move/up collects `{x,y,p: e.pressure || 0.5}`; `pointerType === "touch"` with `touch-action: none`; renders live `<path>` via `strokeToPath`; up → `createInk`. Multi-stroke ink: strokes within 600 ms are merged into the same annotation.
  - Highlight / Rect: drag → `normalizeRect` → create.
  - Signature: handled in Task 12 (opens dialog).
- `PropertiesPopover` anchors above the selected annotation: color swatches (6 presets + native color input), size slider (pen size / font size / stroke width), opacity for highlight, Delete button, "Save as signature" for image.
- Delete key removes selected annotation (hooked in Task 10 `useShortcuts` through `editorStore.selectedAnnotation`).

- [ ] **Step 1: Failing tests** (jsdom): rendering layer with a rect annotation produces an `<rect>` with PDF-space attributes inside a `<g transform="matrix(...)">`; pointer down/move/up with tool Pen adds an ink annotation to the store with ≥ 2 points; clicking a shape with tool Select sets `selectedAnnotation`.
- [ ] **Step 2–4.** Snappy: pen path updates via `requestAnimationFrame` batching, not per-event setState.
- [ ] **Step 5: Manual proof** incl. trackpad and (if available) touch.
- [ ] **Step 6: Commit** `feat(annotations): overlay layer, drawing tools, properties`

---

### Task 12: Signatures (draw / type / upload, vault, placement)

**Files:**
- Create: `components/editor/SignatureDialog.tsx`, `SignaturePad.tsx`, `lib/signature/typed.ts`, `lib/signature/image.ts`, `lib/signature/image.test.ts`, `lib/signature/typed.test.ts`

**Interfaces:**
```ts
// lib/signature/image.ts
export async function fileToTransparentPng(file: File | Blob): Promise<{ png: Uint8Array; aspect: number }>;
// decodes via createImageBitmap, draws to canvas, pixels with luminance > 0.82 become alpha 0, others alpha scaled; trims to content bbox + 8px pad; returns PNG bytes and w/h
export function thresholdToTransparent(data: Uint8ClampedArray): void;  // pure, in-place, testable without canvas
export function contentBounds(data: Uint8ClampedArray, w: number, h: number): Rect | null;
// lib/signature/typed.ts
export function typedSignatureSvg(text: string, color: RGB): string;  // SVG string using font-family "Caveat Variable", 72px
export async function svgToPng(svg: string): Promise<{ png: Uint8Array; aspect: number }>;
// SignaturePad: perfect-freehand on a <canvas>, pointer events, Clear, returns { png, aspect } via `exportPng()` (trims bbox)
```
- `SignatureDialog({ open, onPlace(png, aspect) })`: tabs Draw / Type / Upload, plus "Saved" list from `repo.listSignatures()` with delete. Checkbox "Save to vault" default on; `repo.saveSignature`. "Place" → `onPlace`.
- Placement (`Toolbar` Signature tool or `S`): opens dialog; on place, create `ImageAnnotation` centred on `activePageId` with width 180 pt (`h = 180 / aspect`), select it, switch tool to Select. Dropping a saved signature from the vault list onto a page also places it there.

- [ ] **Step 1: Failing tests** — `thresholdToTransparent` makes white pixels transparent and keeps dark; `contentBounds` finds the bbox of non-transparent pixels and returns null for an empty buffer; `typedSignatureSvg` includes the text and font family.
- [ ] **Step 2–4.**
- [ ] **Step 5: Manual proof**: draw with trackpad; type; upload a photo of a signature; verify transparent background over page content; reload page → vault persists.
- [ ] **Step 6: Commit** `feat(signature): draw/type/upload, vault, placement`

---

### Task 13: Export flow + Playwright end-to-end proof

**Files:**
- Create: `components/editor/ExportButton.tsx`, `playwright.config.ts`, `e2e/editor.spec.ts`, `e2e/fixtures.ts` (reuse `test/fixtures.ts` via import)
- Modify: `Toolbar.tsx` (wire button), `package.json` (`"e2e"`), `.gitignore`

**Behaviour:** `ExportButton`: on click → `toast.loading("Exporting…")` with progress text updated from `onProgress`, runs `exportWorkspace`, then `downloadBytes(bytes, `${ws.name}.pdf`)`, `toast.success("Exported N pages")`. Errors → `toast.error(message)`. Button disabled while running.

`playwright.config.ts`: `webServer: { command: "bun run dev", url: "http://localhost:3000", reuseExistingServer: !process.env.CI }`, chromium only, `acceptDownloads: true`.

- [ ] **Step 1: Write the e2e** (`e2e/editor.spec.ts`) — the user's scenario:
```ts
test("merge two 5-page PDFs, delete two, sign, export 8 pages with a signature", async ({ page }) => {
  const a = await makePdf(5, "a"); const b = await makePdf(5, "b");
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles([{ name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from(a) }, { name: "b.pdf", mimeType: "application/pdf", buffer: Buffer.from(b) }]);
  await expect(page).toHaveURL(/\/edit\//);
  await expect(page.getByTestId("thumbnail")).toHaveCount(10);
  await page.getByTestId("thumbnail").nth(1).click();
  await page.getByTestId("thumbnail").nth(3).click({ modifiers: ["Meta"] });
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("thumbnail")).toHaveCount(8);
  await page.keyboard.press("s");
  const pad = page.getByTestId("signature-pad");
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40); await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(box.x + 20 + i * 8, box.y + 40 + Math.sin(i) * 15);
  await page.mouse.up();
  await page.getByRole("button", { name: "Place" }).click();
  await expect(page.getByTestId("annotation-image")).toHaveCount(1);
  const dl = page.waitForEvent("download");
  await page.keyboard.press("Meta+e");
  const download = await dl; const bytes = await streamToBuffer(await download.createReadStream());
  const out = await PDFDocument.load(bytes);
  expect(out.getPageCount()).toBe(8);
  expect(out.getPages().map(p => p.getWidth())).toEqual([400, 402, 404, 400, 401, 402, 403, 404]);
  const xobj = out.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"));
  expect(xobj?.toString()).toContain("Image");
});
test("workspace survives reload", ...);  // after deleting pages, reload → still 8 thumbnails
test("rejects an encrypted PDF with a toast", ...);
```
Add `data-testid="thumbnail"`, `"signature-pad"`, `"annotation-image"` in the components.
- [ ] **Step 2: Run e2e** → fails (no export). **Step 3: Implement ExportButton + wiring.** **Step 4: Run** `bun run e2e` → passes. Playwright manages the server.
- [ ] **Step 5: Commit** `feat(export): download flow + e2e scenario`

---

### Task 14: Polish pass + deploy to Vercel **[HIGH-RISK]** (external integration)

**Files:**
- Modify: `app/layout.tsx` (metadata, theme-color, favicon), `README.md` (replace with product README: what it is, privacy model, scripts), `next.config.ts` (`headers` for `Cross-Origin-Opener-Policy`? not needed; keep minimal), create `vercel.ts` only if needed (default framework detection suffices).

- [ ] **Step 1:** `bun run lint && bun run typecheck && bun run test && bun run build && bun run e2e` all green.
- [ ] **Step 2:** Confirm privacy constraint: `grep -r "use server" app components lib` and `find app -name route.ts` both empty.
- [ ] **Step 3:** Deploy using the `vercel:deploy` skill with `prod`. If the project is not linked, link/create a project named `paper-pdf-editor` under the user's personal scope.
- [ ] **Step 4: Live proof.** Run the Task 13 e2e against the production URL (`PLAYWRIGHT_BASE_URL=https://… bun run e2e` with `webServer` disabled when the env var is set). Report the URL and pass output.
- [ ] **Step 5: Commit** `chore: readme, metadata, deploy config` and push.
