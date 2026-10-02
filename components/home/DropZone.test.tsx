// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "./DropZone";

const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });

const textFile = (name: string) => new File(["hello"], name, { type: "text/plain" });

const fileInput = () => screen.getByTestId("file-input");

afterEach(cleanup);

describe("DropZone", () => {
  it("reports every file chosen through the file input", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const files = [pdf("contract.pdf"), pdf("invoice.pdf")];
    fireEvent.change(fileInput(), { target: { files } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual(files);
  });

  it("reports no files when a drop carries nothing that looks like a PDF", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: { files: [textFile("notes.txt")], types: ["Files"] },
    });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual([]);
  });

  it("keeps the PDFs out of a mixed drop", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const keep = pdf("contract.pdf");
    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: { files: [textFile("notes.txt"), keep], types: ["Files"] },
    });

    expect(onFiles.mock.calls[0][0]).toEqual([keep]);
  });

  it("stays highlighted while a child element takes over the drag", () => {
    render(<DropZone onFiles={vi.fn()} />);
    const zone = screen.getByTestId("drop-zone");

    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } });
    expect(zone.dataset.dragging).toBe("true");

    // A drag crossing into a child fires enter before the parent's leave.
    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"] } });
    fireEvent.dragLeave(zone, { dataTransfer: { types: ["Files"] } });
    expect(zone.dataset.dragging).toBe("true");

    fireEvent.dragLeave(zone, { dataTransfer: { types: ["Files"] } });
    expect(zone.dataset.dragging).toBeUndefined();
  });

  it("opens pasted PDFs", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const pasted = pdf("scan.pdf");
    fireEvent.paste(document, { clipboardData: { files: [pasted] } });

    expect(onFiles.mock.calls[0][0]).toEqual([pasted]);
  });

  it("ignores a paste that carries no files", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    fireEvent.paste(document, { clipboardData: { files: [] } });

    expect(onFiles).not.toHaveBeenCalled();
  });
});
