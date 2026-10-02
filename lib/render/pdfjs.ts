import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { SourceDoc } from "@/lib/pdf/types";

type Pdfjs = typeof import("pdfjs-dist");

/** Served from `public/`; copied there by `scripts/copy-pdf-worker.mjs`. */
const WORKER_SRC = "/pdf.worker.min.mjs";

let pdfjsPromise: Promise<Pdfjs> | null = null;
const documents = new Map<string, Promise<PDFDocumentLoadingTask>>();

export function getPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    // In Node pdf.js pre-fills a fake-worker path; only the browser needs ours.
    pdfjs.GlobalWorkerOptions.workerSrc ||= WORKER_SRC;
    return pdfjs;
  });
  return pdfjsPromise;
}

export function getSourceDocument(src: SourceDoc): Promise<PDFDocumentProxy> {
  let task = documents.get(src.id);
  if (!task) {
    // pdf.js transfers (detaches) the buffer it is given; the workspace keeps the original.
    task = getPdfjs().then((pdfjs) => pdfjs.getDocument({ data: src.bytes.slice() }));
    documents.set(src.id, task);
  }
  return task.then((t) => t.promise);
}

export function releaseSource(id: string): void {
  const task = documents.get(id);
  if (!task) return;
  documents.delete(id);
  void task.then((t) => t.destroy()).catch(() => undefined);
}
