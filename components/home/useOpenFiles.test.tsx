// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTests, repo } from "@/lib/storage/repo";
import { makeEncryptedPdf, makePdf } from "@/test/fixtures";
import { useOpenFiles } from "./useOpenFiles";

const { push, toastError } = vi.hoisted(() => ({ push: vi.fn(), toastError: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

// `Uint8Array` is generic over ArrayBufferLike, which TS will not narrow to BlobPart; ours never is.
const fileOf = (bytes: Uint8Array, name: string): File =>
  new File([bytes as BlobPart], name, { type: "application/pdf" });

beforeEach(async () => {
  vi.clearAllMocks();
  __resetForTests();
  await repo.clearAll();
});

describe("useOpenFiles", () => {
  it("opens the PDFs that load and names the one that did not", async () => {
    const files = [
      fileOf(await makePdf(2, "lease"), "lease.pdf"),
      fileOf(await makeEncryptedPdf(), "secret.pdf"),
    ];
    const { result } = renderHook(() => useOpenFiles());

    await act(async () => {
      await result.current.open(files);
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("secret.pdf is password protected");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/edit\/.+/);
    expect(result.current.busy).toBe(false);

    const saved = await repo.listWorkspaces();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("lease");
    expect(saved[0].pageCount).toBe(2);
  });

  it("ignores a second gesture while the first is still opening", async () => {
    const file = fileOf(await makePdf(1, "contract"), "contract.pdf");
    const { result } = renderHook(() => useOpenFiles());

    await act(async () => {
      await Promise.all([result.current.open([file]), result.current.open([file])]);
    });

    expect(push).toHaveBeenCalledTimes(1);
    expect(await repo.listWorkspaces()).toHaveLength(1);
    expect(result.current.busy).toBe(false);
  });

  it("does nothing when handed no files", async () => {
    const { result } = renderHook(() => useOpenFiles());

    await act(async () => {
      await result.current.open([]);
    });

    expect(push).not.toHaveBeenCalled();
    expect(await repo.listWorkspaces()).toHaveLength(0);
  });
});
