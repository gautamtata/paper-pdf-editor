// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBytes } from "./utils";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("downloadBytes", () => {
  it("clicks an anchor carrying the filename and a blob URL, then revokes it", () => {
    vi.useFakeTimers();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:paper/1");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadBytes(new Uint8Array([37, 80, 68, 70]), "report.pdf");

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("report.pdf");
    expect(anchor.getAttribute("href")).toBe("blob:paper/1");
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:paper/1");
  });
});
