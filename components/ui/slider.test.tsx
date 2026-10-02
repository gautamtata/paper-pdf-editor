// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Slider } from "./slider";

afterEach(cleanup);

describe("Slider", () => {
  it("labels the thumb from aria-label on the root", () => {
    render(<Slider aria-label="Zoom" defaultValue={[100]} min={50} max={400} />);
    expect(screen.getByRole("slider", { name: "Zoom" })).toBeTruthy();
  });

  it("labels each thumb of a range slider from a thumbProps array", () => {
    render(
      <Slider
        defaultValue={[10, 90]}
        thumbProps={[{ "aria-label": "First page" }, { "aria-label": "Last page" }]}
      />,
    );
    expect(screen.getByRole("slider", { name: "First page" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Last page" })).toBeTruthy();
  });

  it("renders one thumb per value", () => {
    render(<Slider aria-label="Range" defaultValue={[10, 90]} />);
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });

  it("keeps the thumb base classes when thumbProps adds one", () => {
    render(
      <Slider
        aria-label="Zoom"
        defaultValue={[50]}
        thumbProps={{ className: "size-5" }}
      />,
    );
    const thumb = screen.getByRole("slider", { name: "Zoom" });
    expect(thumb.className).toContain("border-accent");
    expect(thumb.className).toContain("size-5");
    expect(thumb.className).not.toContain("size-4");
  });
});
