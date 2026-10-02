import Dexie, { type Table } from "dexie";
import type { SourcePageInfo, VirtualPage } from "@/lib/pdf/types";

export interface SourceRecord {
  id: string;
  name: string;
  bytes: Blob;
  pageCount: number;
  pages: SourcePageInfo[];
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  pages: VirtualPage[];
  sourceIds: string[];
  updatedAt: number;
  /** Data URL of the first page, rendered by the caller. */
  thumbnail?: string;
}

export interface SignatureRecord {
  id: string;
  name: string;
  png: Blob;
  createdAt: number;
}

export class PaperDB extends Dexie {
  sources!: Table<SourceRecord, string>;
  workspaces!: Table<WorkspaceRecord, string>;
  signatures!: Table<SignatureRecord, string>;

  constructor() {
    super("paper");
    this.version(1).stores({
      sources: "id",
      workspaces: "id, updatedAt",
      signatures: "id, createdAt",
    });
  }
}

// Constructing a Dexie instance touches no `indexedDB`; it opens lazily on the
// first query, so importing this module is safe during server rendering.
export const db = new PaperDB();
