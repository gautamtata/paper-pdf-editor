import { toast } from "sonner";
import { PdfLoadError, loadSource } from "@/lib/pdf/load";
import type { SourceDoc } from "@/lib/pdf/types";

/**
 * Parses picked PDFs (already filtered to PDFs by the caller) into sources, toasting once per
 * file that could not be read and returning the ones that could.
 */
export async function loadPdfFiles(files: File[]): Promise<SourceDoc[]> {
  const sources: SourceDoc[] = [];
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      sources.push(await loadSource(file.name, bytes));
    } catch (err) {
      if (err instanceof PdfLoadError) {
        toast.error(err.message);
      } else {
        console.error(err);
        toast.error(`Couldn't read ${file.name}`);
      }
    }
  }
  return sources;
}
