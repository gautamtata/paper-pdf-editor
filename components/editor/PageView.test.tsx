// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPage } from "@/lib/render/renderer";
import { makeWorkspace } from "@/test/fixtures";
import { PageView } from "./PageView";

vi.mock("@/lib/render/renderer", () => ({
  renderPage: vi.fn(),
  getViewportSize: (size: { w: number; h: number }, _i: number, _v: number, scale: number) => ({
    width: size.w * scale,
    height: size.h * scale,
  }),
  getViewportTransform: (size: { w: number; h: number }, _i: number, _v: number, scale: number) => [
    scale,
    0,
    0,
    -scale,
    0,
    size.h * scale,
  ],
}));

afterEach(cleanup);

const rendered = () => ({
  canvas: document.createElement("canvas"),
  width: 400,
  height: 600,
  transform: [1, 0, 0, -1, 0, 600] as [number, number, number, number, number, number],
});

describe("PageView render failure", () => {
  it("offers a retry after a failed render, and paints once the retry succeeds", async () => {
    const draw = vi.mocked(renderPage);
    draw.mockRejectedValueOnce(new Error("worker 404")).mockResolvedValue(rendered());
    const silence = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ws = makeWorkspace(1);
    const page = ws.pages[0];
    const source = ws.sources[page.sourceId ?? ""];

    const view = render(
      <PageView
        page={page}
        index={0}
        source={source}
        displayScale={1}
        renderScale={1}
        near
        selected={false}
        onSelect={() => undefined}
      />,
    );

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByRole("alert").textContent).toContain("Couldn't render");
    expect(view.container.querySelector("canvas")?.className).toContain("opacity-0");

    fireEvent.click(retry);
    await waitFor(() => {
      expect(view.container.querySelector("canvas")?.className).toContain("opacity-100");
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(draw).toHaveBeenCalledTimes(2);
    expect(silence).toHaveBeenCalledTimes(1);
  });
});
