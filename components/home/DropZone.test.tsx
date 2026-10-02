// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "./DropZone";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const errors = vi.mocked(toast.error);

const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });

const textFile = (name: string) => new File(["hello"], name, { type: "text/plain" });

const fileInput = () => screen.getByTestId("file-input");

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("DropZone", () => {
  it("reports every file chosen through the file input", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const files = [pdf("contract.pdf"), pdf("invoice.pdf")];
    fireEvent.change(fileInput(), { target: { files } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual(files);
    expect(errors).not.toHaveBeenCalled();
  });

  it("reports no files, and says why, when a drop carries nothing that looks like a PDF", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: { files: [textFile("notes.txt")], types: ["Files"] },
    });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("Only PDF files are supported");
  });

  it("warns once about a mixed drop and passes on only the PDFs", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const keep = pdf("contract.pdf");
    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: {
        files: [textFile("notes.txt"), keep, textFile("photo.jpg")],
        types: ["Files"],
      },
    });

    expect(onFiles.mock.calls[0][0]).toEqual([keep]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("Only PDF files are supported");
  });

  it("stays quiet when every dropped file is a PDF", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const files = [pdf("a.pdf"), pdf("b.pdf")];
    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: { files, types: ["Files"] },
    });

    expect(onFiles.mock.calls[0][0]).toEqual(files);
    expect(errors).not.toHaveBeenCalled();
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
    expect(errors).not.toHaveBeenCalled();
  });

  it("says why when a paste carries something that is not a PDF", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    const keep = pdf("scan.pdf");
    fireEvent.paste(document, {
      clipboardData: { files: [textFile("notes.txt"), keep] },
    });

    expect(onFiles.mock.calls[0][0]).toEqual([keep]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("Only PDF files are supported");
  });

  it("ignores a paste that carries no files", () => {
    const onFiles = vi.fn();
    render(<DropZone onFiles={onFiles} />);

    fireEvent.paste(document, { clipboardData: { files: [] } });

    expect(onFiles).not.toHaveBeenCalled();
  });
});
