// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredSignature } from "@/lib/storage/repo";
import { TINY_PNG } from "@/test/fixtures";
import { SignatureVault } from "./SignatureVault";

const SIGNATURE: StoredSignature = {
  id: "sig-1",
  name: "Signature 1",
  png: TINY_PNG,
  createdAt: 0,
};

/**
 * jsdom applies no Tailwind, so the two display rules this component's reveal depends on are
 * declared here: `display: none` is exactly what used to put the delete button out of reach.
 */
const withTailwindDisplay = (): void => {
  const style = document.createElement("style");
  style.textContent = ".hidden{display:none}.flex{display:flex}";
  document.head.append(style);
};

afterEach(cleanup);

describe("SignatureVault", () => {
  it("offers the saved signatures to place", () => {
    const onPick = vi.fn();
    render(
      <SignatureVault signatures={[SIGNATURE]} busy={false} onPick={onPick} onDelete={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId("saved-signature"));

    expect(onPick).toHaveBeenCalledWith(SIGNATURE);
  });

  it("lets the keyboard reach the delete button", () => {
    withTailwindDisplay();
    const onDelete = vi.fn();
    render(
      <SignatureVault signatures={[SIGNATURE]} busy={false} onPick={vi.fn()} onDelete={onDelete} />,
    );

    const remove = screen.getByRole("button", { name: /delete/i });
    expect(remove.tabIndex).not.toBe(-1);
    expect(getComputedStyle(remove).display).not.toBe("none");

    remove.focus();
    expect(document.activeElement).toBe(remove);

    fireEvent.click(remove);
    expect(onDelete).toHaveBeenCalledWith(SIGNATURE.id);
  });

  it("says where saved signatures will appear while there are none", () => {
    render(<SignatureVault signatures={[]} busy={false} onPick={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByTestId("saved-signature")).toBeNull();
    expect(screen.getByText(/show up here/i)).toBeTruthy();
  });
});
