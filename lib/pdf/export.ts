import {
  degrees,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFPage,
  StandardFonts,
  type PDFPageLeaf,
} from "pdf-lib";
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

/**
 * A second virtual page over the same source page gets its own leaf: the copier hands back one
 * node per source page, and content drawn on one copy must not show on the other. Resources stay
 * shared; `Contents` is detached so each page appends to its own stream list.
 */
function clonePage(doc: PDFDocument, page: PDFPage): PDFPage {
  const leaf: PDFPageLeaf = page.node.clone(doc.context);
  const contents = leaf.Contents();
  if (contents instanceof PDFArray) {
    leaf.set(PDFName.of("Contents"), doc.context.obj(contents.asArray()));
  }
  return PDFPage.of(leaf, doc.context.register(leaf), doc);
}

/**
 * One `copyPages` per source: pdf-lib builds a fresh object copier per call, so copying page by
 * page would embed every shared font and image once per page. Returns a page per virtual page
 * (`null` for blanks), cloned while still pristine when a source page is used twice.
 */
async function copyUsedPages(
  doc: PDFDocument,
  ws: Workspace,
  loaded: Loaded,
): Promise<(PDFPage | null)[]> {
  const wanted = new Map<SourceId, Set<number>>();
  for (const vp of ws.pages) {
    if (vp.sourceId === null) continue;
    let set = wanted.get(vp.sourceId);
    if (set === undefined) wanted.set(vp.sourceId, (set = new Set()));
    set.add(vp.sourceIndex);
  }
  const copied = new Map<string, PDFPage>();
  for (const [sourceId, set] of wanted) {
    const srcDoc = loaded.get(sourceId);
    if (srcDoc === undefined) throw new Error(`Missing source ${sourceId}`);
    const indices = [...set].sort((a, b) => a - b);
    const pages = await doc.copyPages(srcDoc, indices);
    indices.forEach((index, i) => copied.set(`${sourceId}:${index}`, pages[i]));
  }
  const taken = new Set<string>();
  return ws.pages.map((vp) => {
    if (vp.sourceId === null) return null;
    const key = `${vp.sourceId}:${vp.sourceIndex}`;
    const page = copied.get(key);
    if (page === undefined) throw new Error(`Missing source ${vp.sourceId}`);
    const own = taken.has(key) ? clonePage(doc, page) : page;
    taken.add(key);
    return own;
  });
}

function materialize(doc: PDFDocument, ws: Workspace, vp: VirtualPage, copy: PDFPage | null): PDFPage {
  if (vp.sourceId === null || copy === null) {
    const page = doc.addPage([vp.size.w, vp.size.h]);
    page.setRotation(degrees(vp.rotation));
    return page;
  }
  const info = ws.sources[vp.sourceId]?.pages[vp.sourceIndex];
  if (info === undefined) throw new Error(`Missing source ${vp.sourceId}`);
  doc.addPage(copy);
  copy.setRotation(degrees(addRotation(info.rotation, vp.rotation)));
  return copy;
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
  const copies = await copyUsedPages(doc, ws, loaded);
  const total = ws.pages.length;
  for (let i = 0; i < total; i++) {
    const vp = ws.pages[i];
    const page = materialize(doc, ws, vp, copies[i]);
    await flattenAnnotations(page, vp.annotations, ctx);
    onProgress?.(i + 1, total);
  }
  return doc.save({ useObjectStreams: true });
}
