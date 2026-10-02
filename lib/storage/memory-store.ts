import { usedSourceIds } from "@/lib/pdf/ops";
import type { SourceDoc, SourceId, Workspace } from "@/lib/pdf/types";
import type { Store, StoredSignature } from "@/lib/storage/repo";

interface Entry {
  ws: Workspace;
  thumbnail?: string;
}

const entries = new Map<string, Entry>();
const signatures = new Map<string, StoredSignature>();

/** A detached copy carrying only the sources its pages reference, as the DB store does. */
function detach(ws: Workspace): Workspace {
  const used = usedSourceIds(ws.pages);
  const sources: Record<SourceId, SourceDoc> = {};
  for (const id of used) {
    const src = ws.sources[id];
    if (src !== undefined) sources[id] = src;
  }
  return structuredClone({ ...ws, sources });
}

export const memoryStore: Store = {
  async saveWorkspace(ws, thumbnail) {
    const kept = thumbnail ?? entries.get(ws.id)?.thumbnail;
    const entry: Entry = { ws: detach(ws) };
    if (kept !== undefined) entry.thumbnail = kept;
    entries.set(ws.id, entry);
  },

  async getWorkspace(id) {
    const entry = entries.get(id);
    return entry === undefined ? undefined : structuredClone(entry.ws);
  },

  async listWorkspaces() {
    return [...entries.values()]
      .map(({ ws, thumbnail }) => ({
        id: ws.id,
        name: ws.name,
        pageCount: ws.pages.length,
        updatedAt: ws.updatedAt,
        ...(thumbnail === undefined ? {} : { thumbnail }),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async deleteWorkspace(id) {
    entries.delete(id);
  },

  async saveSignature(signature) {
    signatures.set(signature.id, structuredClone(signature));
  },

  async listSignatures() {
    return [...signatures.values()]
      .map((s) => structuredClone(s))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async deleteSignature(id) {
    signatures.delete(id);
  },

  async clear() {
    entries.clear();
    signatures.clear();
  },
};

/** Best-effort copy of everything still readable in `from`; read failures are skipped. */
export async function hydrateMemory(from: Store): Promise<void> {
  const summaries = await from.listWorkspaces().catch(() => []);
  for (const summary of summaries) {
    try {
      const ws = await from.getWorkspace(summary.id);
      if (ws !== undefined) await memoryStore.saveWorkspace(ws, summary.thumbnail);
    } catch {
      // A workspace we cannot read is one we cannot rescue.
    }
  }
  for (const signature of await from.listSignatures().catch(() => [])) {
    await memoryStore.saveSignature(signature);
  }
}
