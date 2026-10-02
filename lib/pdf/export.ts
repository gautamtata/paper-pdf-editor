import { degrees, PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import { flattenAnnotations, type FlattenContext } from "@/lib/annotations/flatten";
import { usedSourceIds } from "@/lib/pdf/ops";
import { addRotation, type SourceId, type VirtualPage, type Workspace } from "@/lib/pdf/types";

export type ExportProgress = (done: number, total: number) => void;

type Loaded = Map<SourceId, PDFDocument>;

async function loadUsedSources(ws: Workspace): Promise<Loaded> {
  const loaded: Loaded = new Map();
  for (const id of usedSourceIds(ws.pages)) {
    const src = ws.sources[id];
    if (src === undefined) throw new Error(`Missing source ${id}`);
    try {
      loaded.set(id, await PDFDocument.load(src.bytes, { ignoreEncryption: false }));
    } catch {
      throw new Error(`Couldn't read ${src.name}`);
    }
  }
  return loaded;
}

async function materialize(
  doc: PDFDocument,
  ws: Workspace,
  loaded: Loaded,
  vp: VirtualPage,
): Promise<PDFPage> {
  if (vp.sourceId === null) {
    const page = doc.addPage([vp.size.w, vp.size.h]);
    page.setRotation(degrees(vp.rotation));
    return page;
  }
  const srcDoc = loaded.get(vp.sourceId);
  const info = ws.sources[vp.sourceId]?.pages[vp.sourceIndex];
  if (srcDoc === undefined || info === undefined) throw new Error(`Missing source ${vp.sourceId}`);
  const [page] = await doc.copyPages(srcDoc, [vp.sourceIndex]);
  doc.addPage(page);
  page.setRotation(degrees(addRotation(info.rotation, vp.rotation)));
  return page;
}

/** Builds a new PDF from the workspace's pages, flattening annotations. Never mutates `ws`. */
export async function exportWorkspace(
  ws: Workspace,
  onProgress?: ExportProgress,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ctx: FlattenContext = { doc, font, imageCache: new Map() };
  const loaded = await loadUsedSources(ws);
  const total = ws.pages.length;
  for (let i = 0; i < total; i++) {
    const vp = ws.pages[i];
    const page = await materialize(doc, ws, loaded, vp);
    await flattenAnnotations(page, vp.annotations, ctx);
    onProgress?.(i + 1, total);
  }
  return doc.save({ useObjectStreams: true });
}
