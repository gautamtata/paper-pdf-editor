import { usedSourceIds } from "@/lib/pdf/ops";
import { newId, type SourceDoc, type SourceId, type Workspace } from "@/lib/pdf/types";
import { db } from "@/lib/storage/db";
import { hydrateMemory, memoryStore } from "@/lib/storage/memory-store";

export interface WorkspaceSummary {
  id: string;
  name: string;
  pageCount: number;
  updatedAt: number;
  thumbnail?: string;
}

export interface StoredSignature {
  id: string;
  name: string;
  png: Uint8Array;
  createdAt: number;
}

/** The persistence operations, implemented once against Dexie and once against `Map`s. */
export interface Store {
  saveWorkspace(ws: Workspace, thumbnail?: string): Promise<void>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  deleteWorkspace(id: string): Promise<void>;
  saveSignature(signature: StoredSignature): Promise<void>;
  listSignatures(): Promise<StoredSignature[]>;
  deleteSignature(id: string): Promise<void>;
  clear(): Promise<void>;
}

const toBytes = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

// `Uint8Array` is generic over ArrayBufferLike, which TS will not narrow to
// BlobPart (it could be SharedArrayBuffer-backed); ours never is.
const toBlob = (bytes: Uint8Array): Blob => new Blob([bytes as BlobPart]);

const dexieStore: Store = {
  async saveWorkspace(ws, thumbnail) {
    const sourceIds = [...usedSourceIds(ws.pages)];
    await db.transaction("rw", db.sources, db.workspaces, async () => {
      for (const id of sourceIds) {
        // Sources are content-immutable, so an existing record never needs rewriting.
        if ((await db.sources.get(id)) !== undefined) continue;
        const src = ws.sources[id];
        // Saving anyway would persist a workspace that `getWorkspace` reports as corrupt.
        if (src === undefined) throw new Error(`saveWorkspace: no bytes for source ${id}`);
        await db.sources.put({
          id,
          name: src.name,
          bytes: toBlob(src.bytes),
          pageCount: src.pageCount,
          pages: src.pages,
        });
      }
      const kept = thumbnail ?? (await db.workspaces.get(ws.id))?.thumbnail;
      await db.workspaces.put({
        id: ws.id,
        name: ws.name,
        pages: ws.pages,
        sourceIds,
        updatedAt: ws.updatedAt,
        ...(kept === undefined ? {} : { thumbnail: kept }),
      });
    });
  },

  async getWorkspace(id) {
    const record = await db.workspaces.get(id);
    if (record === undefined) return undefined;
    const sources: Record<SourceId, SourceDoc> = {};
    for (const sourceId of record.sourceIds) {
      const src = await db.sources.get(sourceId);
      // A workspace missing one of its sources cannot be rendered, so treat it as corrupt.
      if (src === undefined) return undefined;
      sources[sourceId] = {
        id: src.id,
        name: src.name,
        bytes: await toBytes(src.bytes),
        pageCount: src.pageCount,
        pages: src.pages,
      };
    }
    const { id: wsId, name, pages, updatedAt } = record;
    return { id: wsId, name, sources, pages, updatedAt };
  },

  async listWorkspaces() {
    const records = await db.workspaces.orderBy("updatedAt").reverse().toArray();
    return records.map(({ id, name, pages, updatedAt, thumbnail }) => ({
      id,
      name,
      pageCount: pages.length,
      updatedAt,
      ...(thumbnail === undefined ? {} : { thumbnail }),
    }));
  },

  async deleteWorkspace(id) {
    await db.transaction("rw", db.sources, db.workspaces, async () => {
      const record = await db.workspaces.get(id);
      if (record === undefined) return;
      await db.workspaces.delete(id);
      const stillUsed = new Set(
        (await db.workspaces.toArray()).flatMap((workspace) => workspace.sourceIds),
      );
      const orphans = record.sourceIds.filter((sourceId) => !stillUsed.has(sourceId));
      if (orphans.length > 0) await db.sources.bulkDelete(orphans);
    });
  },

  async saveSignature({ id, name, png, createdAt }) {
    await db.signatures.put({ id, name, png: toBlob(png), createdAt });
  },

  async listSignatures() {
    const records = await db.signatures.orderBy("createdAt").reverse().toArray();
    return Promise.all(
      records.map(async ({ id, name, png, createdAt }) => ({
        id,
        name,
        png: await toBytes(png),
        createdAt,
      })),
    );
  },

  async deleteSignature(id) {
    await db.signatures.delete(id);
  },

  async clear() {
    await db.transaction("rw", db.sources, db.workspaces, db.signatures, async () => {
      await Promise.all([db.sources.clear(), db.workspaces.clear(), db.signatures.clear()]);
    });
  },
};

let memoryOnly = false;
const listeners = new Set<(memoryOnly: boolean) => void>();

const isQuotaError = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const { name, inner } = err as { name?: unknown; inner?: { name?: unknown } };
  return name === "QuotaExceededError" || inner?.name === "QuotaExceededError";
};

async function fallBackToMemory(): Promise<void> {
  await hydrateMemory(dexieStore);
  memoryOnly = true;
  for (const listener of listeners) listener(true);
}

const read = <T>(run: (store: Store) => Promise<T>): Promise<T> =>
  run(memoryOnly ? memoryStore : dexieStore);

async function write<T>(run: (store: Store) => Promise<T>): Promise<T> {
  if (memoryOnly) return run(memoryStore);
  try {
    return await run(dexieStore);
  } catch (err) {
    if (!isQuotaError(err)) throw err;
    await fallBackToMemory();
    return run(memoryStore);
  }
}

export const repo = {
  saveWorkspace: (ws: Workspace, thumbnail?: string): Promise<void> =>
    write((store) => store.saveWorkspace(ws, thumbnail)),

  getWorkspace: (id: string): Promise<Workspace | undefined> =>
    read((store) => store.getWorkspace(id)),

  listWorkspaces: (): Promise<WorkspaceSummary[]> => read((store) => store.listWorkspaces()),

  deleteWorkspace: (id: string): Promise<void> => write((store) => store.deleteWorkspace(id)),

  async saveSignature(name: string, png: Uint8Array): Promise<StoredSignature> {
    const signature: StoredSignature = { id: newId(), name, png, createdAt: Date.now() };
    await write((store) => store.saveSignature(signature));
    return signature;
  },

  listSignatures: (): Promise<StoredSignature[]> => read((store) => store.listSignatures()),

  deleteSignature: (id: string): Promise<void> => write((store) => store.deleteSignature(id)),

  /** Clears both backends: local data must be gone wherever it ended up. */
  async clearAll(): Promise<void> {
    await memoryStore.clear();
    await dexieStore.clear();
  },

  isMemoryOnly: (): boolean => memoryOnly,

  onModeChange(cb: (memoryOnly: boolean) => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

/** Test-only: forgets memory-only mode and its subscribers. */
export function __resetForTests(): void {
  memoryOnly = false;
  listeners.clear();
}
