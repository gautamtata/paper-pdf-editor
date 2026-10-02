// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "@/lib/pdf/types";
import { repo } from "@/lib/storage/repo";
import { workspaceStore } from "@/lib/store/workspace";
import { makeWorkspace } from "@/test/fixtures";
import { useAutosave } from "./useAutosave";

vi.mock("@/lib/storage/repo", () => ({
  repo: { saveWorkspace: vi.fn() },
}));

const saveWorkspace = vi.mocked(repo.saveWorkspace);
const thumbnail = { current: undefined };

/** Saves that only settle when the test says so, so an edit can land mid-save. */
let settle: Array<() => void> = [];

const rotateFirstPage = () => {
  const pages = workspaceStore.getState().workspace?.pages ?? [];
  workspaceStore.getState().rotatePages([pages[0].id], 90);
};
const rotateLastPage = () => {
  const pages = workspaceStore.getState().workspace?.pages ?? [];
  workspaceStore.getState().rotatePages([pages[pages.length - 1].id], 90);
};
const current = (): Workspace | null => workspaceStore.getState().workspace;

beforeEach(() => {
  vi.useFakeTimers();
  settle = [];
  saveWorkspace.mockReset();
  saveWorkspace.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        settle.push(resolve);
      }),
  );
  workspaceStore.getState().load(makeWorkspace(3, "lease"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("writes the edit that landed while an earlier save was still in flight", async () => {
    const { unmount } = renderHook(() => useAutosave(thumbnail));

    act(() => rotateFirstPage());
    act(() => void vi.advanceTimersByTime(600));
    expect(saveWorkspace).toHaveBeenCalledTimes(1);

    // The second edit lands before the first save settles, so settling it must not
    // report the workspace as saved.
    act(() => rotateLastPage());
    const newest = current();
    await act(async () => settle[0]());

    unmount();

    expect(saveWorkspace).toHaveBeenCalledTimes(2);
    expect(saveWorkspace.mock.calls[1][0]).toBe(newest);
  });

  it("does not write again on unmount when the last edit is already saved", async () => {
    const { unmount } = renderHook(() => useAutosave(thumbnail));

    act(() => rotateFirstPage());
    act(() => void vi.advanceTimersByTime(600));
    await act(async () => settle[0]());

    unmount();

    expect(saveWorkspace).toHaveBeenCalledTimes(1);
  });

  it("writes a pending edit when the tab goes away", async () => {
    renderHook(() => useAutosave(thumbnail));

    act(() => rotateFirstPage());
    // Still inside the debounce: nothing has been written yet.
    expect(saveWorkspace).not.toHaveBeenCalled();

    act(() => void window.dispatchEvent(new Event("pagehide")));

    expect(saveWorkspace).toHaveBeenCalledTimes(1);
    expect(saveWorkspace.mock.calls[0][0]).toBe(current());
  });
});
