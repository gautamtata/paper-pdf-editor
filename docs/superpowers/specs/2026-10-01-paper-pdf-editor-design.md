# Paper — local-first PDF editor: design spec

Date: 2026-10-01. Status: approved by owner.

## Goal

A personal PDF editor that runs entirely in the browser. Open PDFs, delete /
reorder / rotate pages, merge several PDFs, extract or split, annotate (text,
ink, highlight, rectangle) and sign, then export. Nothing is ever uploaded.

## Non-goals (v1)

OCR, form filling, editing existing text content, cloud sync, accounts,
collaboration, server-side processing of any kind.

## Privacy model

- No upload route handler exists. The deployed app is static assets + client
  JavaScript. There is no server state.
- Persistence is IndexedDB only (recent documents, autosaved workspace,
  signature vault). A "Clear all local data" action wipes everything.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16.3 App Router, React 19, TypeScript strict |
| Styling | Tailwind 4, shadcn/ui primitives, `lucide-react` icons, `motion` |
| PDF manipulation | `pdf-lib` |
| PDF rendering | `pdfjs-dist` in a web worker, canvas output |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Ink | `perfect-freehand` (stroke → SVG path) |
| State | Zustand store with a command-based undo/redo history |
| Persistence | Dexie (IndexedDB) |
| Unit tests | Vitest + `fake-indexeddb` |
| E2E | Playwright (Chromium) |
| Package manager | Bun |

## Architecture

```
app/
  layout.tsx              theme, fonts, toaster
  page.tsx                Home: drop zone + recent library
  edit/[workspaceId]/page.tsx   Editor shell (client)
lib/
  pdf/
    types.ts              SourceDoc, VirtualPage, Workspace, Rotation enum
    load.ts               bytes -> SourceDoc (pdf-lib parse, page count, sizes); rejects encrypted/malformed
    ops.ts                pure functions on VirtualPage[]: deletePages, movePages, rotatePages,
                          duplicatePages, insertBlank, appendSource, extractPages, splitAt
    export.ts             Workspace -> Uint8Array via pdf-lib copyPages + rotation + annotation flattening
  annotations/
    types.ts              discriminated union: Text | Ink | Highlight | Rect | Image(signature)
    geometry.ts           PDF <-> viewport coordinate transforms
    flatten.ts            draw annotations onto a pdf-lib PDFPage
    ink.ts                points -> perfect-freehand outline -> SVG path string
  render/
    worker.ts             pdfjs worker wrapper: render(pageRef, scale) -> ImageBitmap
    cache.ts              LRU of rendered bitmaps keyed by (sourceId, pageIndex, rotation, scale)
  storage/
    db.ts                 Dexie schema: sources(bytes), workspaces(json), signatures(png)
    repo.ts               typed CRUD + quota fallback
  store/
    workspace.ts          Zustand store; commands; undo/redo; autosave debounce
    selection.ts          page selection + active tool
components/
  home/   DropZone, RecentList
  editor/ ThumbnailRail, PageViewer, AnnotationLayer, Toolbar, PropertiesPopover,
          SignatureDialog (draw / type / upload), CommandPalette, ExportButton
  ui/     shadcn primitives
```

### Virtual page model

```ts
enum Rotation { R0 = 0, R90 = 90, R180 = 180, R270 = 270 }
type SourceId = string; type PageId = string;
interface SourceDoc { id: SourceId; name: string; bytes: Uint8Array; pageCount: number; pageSizes: {w:number;h:number}[] }
interface VirtualPage { id: PageId; sourceId: SourceId | null /* null = blank */; sourceIndex: number; rotation: Rotation; size: {w:number;h:number}; annotations: Annotation[] }
interface Workspace { id: string; name: string; sources: Record<SourceId, SourceDoc>; pages: VirtualPage[]; updatedAt: number }
```

All page operations are pure `(pages, args) => pages`. The store wraps them in
commands `{ apply, invert }` for undo/redo. Export is the only place that
touches pdf-lib for writing.

### Annotations

All geometry is stored in PDF user-space points relative to the *unrotated*
source page. The viewer transforms to screen space; `flatten.ts` draws directly
with pdf-lib. Types:

- `text`: x,y,width, fontSize, color, content (Helvetica, wraps)
- `ink`: points[][] with pressure, color, size → SVG path via perfect-freehand, drawn with `drawSvgPath`
- `highlight`: rect, color, opacity 0.35, multiply blend
- `rect`: rect, strokeColor, strokeWidth, fillColor?
- `image`: rect + PNG bytes (signatures and uploaded images)

### Rendering

pdf.js runs in a dedicated worker. `PageViewer` renders visible pages at the
current zoom via an intersection observer; `ThumbnailRail` renders at a fixed
small scale. The LRU cache holds ~60 bitmaps. Rotation is applied in CSS on the
canvas, not re-rendered.

### Export

1. New `PDFDocument`.
2. Group consecutive pages by source; `copyPages` per source; blank pages via `addPage`.
3. Set `/Rotate` to the virtual rotation.
4. `flatten.ts` draws annotations.
5. `save()` → Blob → download with `<name>.pdf`. Runs in the main thread with
   a progress toast (pdf-lib has no worker requirement; files > 50 MB show a
   warning).

### Persistence

Dexie DB `paper` v1: `sources` (id, bytes Blob, name), `workspaces` (id, json
without bytes, updatedAt), `signatures` (id, name, png Blob, createdAt).
Store autosaves the workspace 500 ms after the last change. Opening a recent
workspace rehydrates sources from `sources`. On `QuotaExceededError` the repo
switches to a memory-only mode and the UI shows a persistent banner.

### Error handling

- Encrypted PDFs: pdf-lib throws → "This PDF is password protected" toast; not added.
- Malformed: "Couldn't read <name>" toast; not added.
- Export failure: toast with message; workspace unchanged.
- Worker crash: viewer shows a retry affordance for the page.

## UI / UX

- Home: full-bleed drop zone; recent documents as cards with first-page thumbnail; "Clear local data" in footer.
- Editor: left thumbnail rail (grid, click/shift/cmd select, drag reorder, context actions, drop PDFs here to merge), center continuous viewer (zoom 25–400 %, fit-width/fit-page), floating bottom toolbar (Select, Text, Pen, Highlight, Rectangle, Signature; Add files; Export), properties popover for the selected annotation, command palette on ⌘K.
- Shortcuts: Delete removes selected pages; ⌘Z/⇧⌘Z undo/redo; R rotate; ⌘A select all; V/T/P/H/S tools; ⌘E export; Esc select tool.
- Signature dialog: Draw (perfect-freehand on a canvas, touch + pencil), Type (script font), Upload (PNG/JPG, background removed by luminance threshold). Save to vault. Placing a signature drops it at the viewport center on the current page, resizable with aspect lock.
- Visual direction: warm paper neutrals (`oklch` stone/sand), Geist Sans/Mono, 8 px radius, soft shadows, 150 ms ease-out transitions, dark mode via `prefers-color-scheme`.
- Responsive: < 900 px the rail becomes a bottom sheet; toolbar scrolls horizontally.

## Testing

- Unit (Vitest): every function in `lib/pdf/ops.ts`; `load.ts` against generated fixtures (valid, encrypted, garbage); `export.ts` reloads output and asserts page count, order (via per-page unique text drawn into fixtures), rotation; `flatten.ts` asserts output contains the drawn content stream ops / embedded image; `storage/repo.ts` against fake-indexeddb incl. quota fallback; store undo/redo.
- E2E (Playwright): open two generated 5-page PDFs → 10 thumbnails; delete 2 → 8; reorder; sign page 1; export; parse download with pdf-lib: 8 pages, image XObject on page 1.
- Live proof: deployed Vercel URL exercised once in a real browser with the same scenario.

## Deployment

Vercel project, production deploy from `main`. No env vars, no integrations.
