import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnnotationKind,
  createImage,
  createText,
  type ImageAnnotation,
} from "@/lib/annotations/types";
import { loadSource } from "@/lib/pdf/load";
import { appendSource } from "@/lib/pdf/ops";
import { newId, type SourceDoc, type Workspace } from "@/lib/pdf/types";
import { db } from "@/lib/storage/db";
import { __resetForTests, repo } from "@/lib/storage/repo";
import { makePdf, TINY_PNG } from "@/test/fixtures";

const quotaError = (): Error => Object.assign(new Error("full"), { name: "QuotaExceededError" });

async function source(name: string, pageCount = 2): Promise<SourceDoc> {
  return loadSource(`${name}.pdf`, await makePdf(pageCount, name));
}

function workspaceOf(name: string, sources: SourceDoc[], updatedAt = 1_000): Workspace {
  let pages: Workspace["pages"] = [];
  const byId: Record<string, SourceDoc> = {};
  for (const src of sources) {
    byId[src.id] = src;
    pages = appendSource(pages, src);
  }
  return { id: newId(), name, sources: byId, pages, updatedAt };
}

beforeEach(async () => {
  __resetForTests();
  await repo.clearAll();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspace round trip", () => {
  it("preserves source bytes and annotations including image png", async () => {
    const src = await source("round");
    const ws = workspaceOf("Round", [src]);
    ws.pages[0].annotations = [
      createText({ x: 10, y: 20, w: 100, h: 30 }, { content: "hi" }),
      createImage({ x: 0, y: 0, w: 10, h: 10 }, TINY_PNG, 1),
    ];

    await repo.saveWorkspace(ws);
    const got = await repo.getWorkspace(ws.id);

    expect(got).toBeDefined();
    expect(got?.name).toBe("Round");
    expect(got?.updatedAt).toBe(1_000);
    expect(got?.pages).toEqual(ws.pages);
    expect(got?.sources[src.id].bytes).toBeInstanceOf(Uint8Array);
    expect(got?.sources[src.id].bytes).toEqual(src.bytes);
    expect(got?.sources[src.id].pages).toEqual(src.pages);

    const image = got?.pages[0].annotations[1] as ImageAnnotation;
    expect(image.kind).toBe(AnnotationKind.Image);
    expect(image.png).toBeInstanceOf(Uint8Array);
    expect(image.png).toEqual(TINY_PNG);
  });

  it("writes each source once and drops unreferenced ones", async () => {
    const used = await source("used");
    const unused = await source("unused");
    const ws = workspaceOf("Mixed", [used]);
    ws.sources[unused.id] = unused;

    await repo.saveWorkspace(ws);
    const sourcePut = vi.spyOn(db.sources, "put");
    await repo.saveWorkspace({ ...ws, updatedAt: 2_000 });

    expect(sourcePut).not.toHaveBeenCalled();
    expect(await db.sources.count()).toBe(1);
    const got = await repo.getWorkspace(ws.id);
    expect(Object.keys(got?.sources ?? {})).toEqual([used.id]);
  });

  it("keeps the previous thumbnail when none is passed", async () => {
    const ws = workspaceOf("Thumb", [await source("t")]);
    await repo.saveWorkspace(ws, "data:image/png;base64,AAA");
    await repo.saveWorkspace({ ...ws, updatedAt: 2_000 });
    expect((await repo.listWorkspaces())[0].thumbnail).toBe("data:image/png;base64,AAA");

    await repo.saveWorkspace({ ...ws, updatedAt: 3_000 }, "data:image/png;base64,BBB");
    expect((await repo.listWorkspaces())[0].thumbnail).toBe("data:image/png;base64,BBB");
  });

  it("refuses to save a page whose source bytes are not available", async () => {
    const src = await source("missing");
    const ws = workspaceOf("Broken", [src]);
    ws.sources = {};

    await expect(repo.saveWorkspace(ws)).rejects.toThrow(/no bytes for source/);
    expect(await db.workspaces.count()).toBe(0);
  });

  it("returns undefined for an unknown id", async () => {
    expect(await repo.getWorkspace("nope")).toBeUndefined();
  });

  it("returns undefined when a referenced source record is missing", async () => {
    const src = await source("gone");
    const ws = workspaceOf("Corrupt", [src]);
    await repo.saveWorkspace(ws);
    await db.sources.delete(src.id);

    expect(await repo.getWorkspace(ws.id)).toBeUndefined();
  });
});

describe("listWorkspaces", () => {
  it("returns summaries newest first without reading source blobs", async () => {
    const older = workspaceOf("Older", [await source("a", 2)], 1_000);
    const newer = workspaceOf("Newer", [await source("b", 3)], 5_000);
    await repo.saveWorkspace(older);
    await repo.saveWorkspace(newer);

    const sourceGet = vi.spyOn(db.sources, "get");
    const summaries = await repo.listWorkspaces();

    expect(summaries.map((s) => s.name)).toEqual(["Newer", "Older"]);
    expect(summaries.map((s) => s.pageCount)).toEqual([3, 2]);
    expect(summaries.map((s) => s.updatedAt)).toEqual([5_000, 1_000]);
    expect(sourceGet).not.toHaveBeenCalled();
  });

  it("is empty with no workspaces", async () => {
    expect(await repo.listWorkspaces()).toEqual([]);
  });
});

describe("deleteWorkspace", () => {
  it("deletes orphaned sources but keeps shared ones", async () => {
    const shared = await source("shared");
    const solo = await source("solo");
    const a = workspaceOf("A", [shared, solo]);
    const b = workspaceOf("B", [shared]);
    await repo.saveWorkspace(a);
    await repo.saveWorkspace(b);
    expect(await db.sources.count()).toBe(2);

    await repo.deleteWorkspace(a.id);

    expect(await repo.getWorkspace(a.id)).toBeUndefined();
    expect(await db.sources.toArray()).toHaveLength(1);
    expect(await db.sources.get(shared.id)).toBeDefined();
    expect(await repo.getWorkspace(b.id)).toBeDefined();

    await repo.deleteWorkspace(b.id);
    expect(await db.sources.count()).toBe(0);
  });

  it("ignores an unknown id", async () => {
    await expect(repo.deleteWorkspace("nope")).resolves.toBeUndefined();
  });
});

describe("signatures", () => {
  it("saves, lists newest first, and deletes", async () => {
    const first = await repo.saveSignature("First", TINY_PNG);
    const second = await repo.saveSignature("Second", TINY_PNG);

    expect(first.id).not.toBe(second.id);
    expect(first.createdAt).toBeGreaterThan(0);

    const listed = await repo.listSignatures();
    expect(listed).toHaveLength(2);
    expect(listed[0].png).toBeInstanceOf(Uint8Array);
    expect(listed[0].png).toEqual(TINY_PNG);
    expect(listed.map((s) => s.createdAt >= listed[listed.length - 1].createdAt)).toEqual([
      true,
      true,
    ]);
    expect(new Set(listed.map((s) => s.name))).toEqual(new Set(["First", "Second"]));

    await repo.deleteSignature(first.id);
    expect((await repo.listSignatures()).map((s) => s.id)).toEqual([second.id]);
  });
});

describe("clearAll", () => {
  it("empties every table", async () => {
    await repo.saveWorkspace(workspaceOf("Gone", [await source("g")]));
    await repo.saveSignature("Sig", TINY_PNG);

    await repo.clearAll();

    expect(await db.workspaces.count()).toBe(0);
    expect(await db.sources.count()).toBe(0);
    expect(await db.signatures.count()).toBe(0);
    expect(await repo.listWorkspaces()).toEqual([]);
    expect(await repo.listSignatures()).toEqual([]);
  });
});

describe("quota fallback", () => {
  it("flips to memory-only, keeps the write, and notifies subscribers", async () => {
    const existing = workspaceOf("Existing", [await source("e")], 1_000);
    await repo.saveWorkspace(existing, "data:image/png;base64,AAA");
    await repo.saveSignature("Sig", TINY_PNG);

    const seen: boolean[] = [];
    const unsubscribe = repo.onModeChange((memoryOnly) => seen.push(memoryOnly));
    vi.spyOn(db.workspaces, "put").mockRejectedValue(quotaError());

    const ws = workspaceOf("Overflow", [await source("o", 3)], 9_000);
    await expect(repo.saveWorkspace(ws)).resolves.toBeUndefined();

    expect(repo.isMemoryOnly()).toBe(true);
    expect(seen).toEqual([true]);

    const got = await repo.getWorkspace(ws.id);
    expect(got?.name).toBe("Overflow");
    expect(got?.sources[ws.pages[0].sourceId ?? ""].bytes).toEqual(
      ws.sources[ws.pages[0].sourceId ?? ""].bytes,
    );
    expect(await db.workspaces.get(ws.id)).toBeUndefined();

    unsubscribe();
    expect(seen).toEqual([true]);
  });

  it("copies what was readable in the database into memory", async () => {
    const existing = workspaceOf("Existing", [await source("e")], 1_000);
    await repo.saveWorkspace(existing, "data:image/png;base64,AAA");
    await repo.saveSignature("Sig", TINY_PNG);

    vi.spyOn(db.workspaces, "put").mockRejectedValue(quotaError());
    await repo.saveWorkspace(workspaceOf("Overflow", [await source("o")], 9_000));

    const summaries = await repo.listWorkspaces();
    expect(summaries.map((s) => s.name)).toEqual(["Overflow", "Existing"]);
    expect(summaries[1].thumbnail).toBe("data:image/png;base64,AAA");

    const copied = await repo.getWorkspace(existing.id);
    expect(copied?.pages).toEqual(existing.pages);
    expect((await repo.listSignatures()).map((s) => s.name)).toEqual(["Sig"]);
  });

  it("stays in memory for later reads, writes, and deletes", async () => {
    vi.spyOn(db.workspaces, "put").mockRejectedValue(quotaError());
    const ws = workspaceOf("Memory", [await source("m")], 1_000);
    await repo.saveWorkspace(ws);
    vi.restoreAllMocks();

    const other = workspaceOf("Other", [await source("n")], 2_000);
    await repo.saveWorkspace(other);

    expect(repo.isMemoryOnly()).toBe(true);
    expect(await db.workspaces.count()).toBe(0);
    expect((await repo.listWorkspaces()).map((s) => s.name)).toEqual(["Other", "Memory"]);

    const sig = await repo.saveSignature("InMemory", TINY_PNG);
    expect((await repo.listSignatures()).map((s) => s.id)).toEqual([sig.id]);
    expect(await db.signatures.count()).toBe(0);

    await repo.deleteWorkspace(other.id);
    expect((await repo.listWorkspaces()).map((s) => s.name)).toEqual(["Memory"]);

    await repo.deleteSignature(sig.id);
    expect(await repo.listSignatures()).toEqual([]);
  });

  it("rethrows non-quota write errors and stays on the database", async () => {
    vi.spyOn(db.workspaces, "put").mockRejectedValue(new Error("boom"));

    await expect(repo.saveWorkspace(workspaceOf("Nope", [await source("x")]))).rejects.toThrow(
      "boom",
    );
    expect(repo.isMemoryOnly()).toBe(false);
  });
});
