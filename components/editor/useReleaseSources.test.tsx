// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeSource } from "@/lib/render/renderer";
import { useReleaseSources } from "./useReleaseSources";

vi.mock("@/lib/render/renderer", () => ({ removeSource: vi.fn() }));

const released = () => vi.mocked(removeSource).mock.calls.map(([id]) => id);

beforeEach(() => vi.mocked(removeSource).mockClear());

describe("useReleaseSources", () => {
  it("releases the previous workspace's sources when another one opens", () => {
    const hook = renderHook(
      ({ id, sources }: { id: string; sources: string[] }) => useReleaseSources(id, sources),
      { initialProps: { id: "ws-a", sources: ["s1", "s2"] } },
    );
    expect(released()).toEqual([]);

    hook.rerender({ id: "ws-a", sources: ["s1", "s2", "s3"] });
    expect(released()).toEqual([]);

    hook.rerender({ id: "ws-b", sources: ["s9"] });
    expect(released()).toEqual(["s1", "s2", "s3"]);
  });

  it("releases every source on unmount", () => {
    const hook = renderHook(() => useReleaseSources("ws-a", ["s1"]));
    hook.unmount();
    expect(released()).toEqual(["s1"]);
  });
});
