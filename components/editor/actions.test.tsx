// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { extractSelected } from "@/components/editor/actions";
import { repo } from "@/lib/storage/repo";
import { editorStore } from "@/lib/store/editor";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace } from "@/test/fixtures";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));
vi.mock("@/lib/storage/repo", () => ({
  repo: { saveWorkspace: vi.fn(() => Promise.resolve()) },
}));

type ToastOptions = { action?: { label: string; onClick: () => void } };

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.message).mockClear();
  workspaceStore.getState().load(makeWorkspace(3, "lease"));
  const [first] = workspaceStore.getState().workspace?.pages ?? [];
  editorStore.getState().selectPage(first.id, "replace", [first.id]);
});

describe("extractSelected", () => {
  it("opens the new document in a tab and confirms", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    await extractSelected();
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^\/edit\//), "_blank");
    expect(toast.success).toHaveBeenCalledWith("Extracted 1 page to a new document");
    expect(toast.message).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("offers an Open action when the browser blocks the tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await extractSelected();
    expect(repo.saveWorkspace).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    const [, options] = vi.mocked(toast.message).mock.calls[0] as [string, ToastOptions];
    expect(options.action?.label).toBe("Open");

    const url = open.mock.calls[0][0];
    options.action?.onClick();
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith(url, "_blank");
    open.mockRestore();
  });
});
