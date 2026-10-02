// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

const INK = { r: 0, g: 0, b: 0 };

const sign = (pad: HTMLElement): void => {
  fireEvent.pointerDown(pad, { pointerId: 1, pointerType: "mouse", clientX: 20, clientY: 40 });
  fireEvent.pointerMove(pad, { pointerId: 1, pointerType: "mouse", clientX: 60, clientY: 70 });
  fireEvent.pointerMove(pad, { pointerId: 1, pointerType: "mouse", clientX: 90, clientY: 30 });
  fireEvent.pointerUp(pad, { pointerId: 1, pointerType: "mouse" });
};

afterEach(cleanup);

describe("SignaturePad", () => {
  it("records a stroke drawn with the mouse", () => {
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} color={INK} />);
    expect(ref.current?.isEmpty()).toBe(true);

    sign(screen.getByTestId("signature-pad"));

    expect(ref.current?.isEmpty()).toBe(false);
  });

  it("tells the dialog when the pad stops being empty", () => {
    const onInkChange = vi.fn();
    render(<SignaturePad color={INK} onInkChange={onInkChange} />);

    sign(screen.getByTestId("signature-pad"));

    expect(onInkChange).toHaveBeenCalledWith(true);
  });

  it("ignores a move that no press started", () => {
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} color={INK} />);

    fireEvent.pointerMove(screen.getByTestId("signature-pad"), {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });

    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("clears back to an empty pad", () => {
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} color={INK} />);
    sign(screen.getByTestId("signature-pad"));

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("offers the canvas to assistive tech with a label", () => {
    render(<SignaturePad color={INK} />);
    expect(screen.getByLabelText(/draw your signature/i)).toBe(screen.getByTestId("signature-pad"));
  });
});
