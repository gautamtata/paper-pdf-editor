// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a button with its label", () => {
    render(<Button>Export</Button>);
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });

  it("merges caller classes over variant classes", () => {
    render(<Button className="rounded-full">Export</Button>);
    const el = screen.getByRole("button", { name: "Export" });
    expect(el.className).toContain("rounded-full");
    expect(el.className).not.toContain("rounded-md");
  });

  it("renders the child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/open">Open</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("data-slot")).toBe("button");
  });
});
