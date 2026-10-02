import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, PDFName } from "pdf-lib";
import { makeEncryptedPdf, makePdf } from "./fixtures";

const MOD = process.platform === "darwin" ? "Meta" : "Control";
/** Covers the 500ms autosave debounce; the editor writes to IndexedDB on a timer. */
const AUTOSAVE_MS = 900;

const pdfFile = (name: string, bytes: Uint8Array) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(bytes),
});

/** Drops two 5-page PDFs on the home screen, which merges them into one open document. */
async function openTwoDocuments(page: Page): Promise<void> {
  const [a, b] = await Promise.all([makePdf(5, "a"), makePdf(5, "b")]);
  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles([pdfFile("a.pdf", a), pdfFile("b.pdf", b)]);
  await expect(page).toHaveURL(/\/edit\//);
  await expect(page.getByTestId("thumbnail")).toHaveCount(10);
}

/** Click, then ⌘-click, then Delete: the 2nd and 4th pages go. */
async function deleteTwoPages(page: Page): Promise<void> {
  await page.getByTestId("thumbnail").nth(1).click();
  await page.getByTestId("thumbnail").nth(3).click({ modifiers: [MOD] });
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("thumbnail")).toHaveCount(8);
}

/** A signature lands on the page in view, so scroll back to the first one and wait for it. */
async function viewFirstPage(page: Page): Promise<void> {
  await page.getByTestId("page").first().scrollIntoViewIfNeeded();
  await expect(page.getByTestId("thumbnail").first()).toHaveAttribute("data-active", "true");
}

async function drawAndPlaceSignature(page: Page): Promise<void> {
  await page.keyboard.press("s");
  const pad = page.getByTestId("signature-pad");
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (box === null) throw new Error("the signature pad has no box to draw in");

  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(box.x + 20 + i * 8, box.y + 40 + Math.sin(i) * 15);
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "Place" }).click();
}

test("merges two PDFs, deletes two pages, signs, and exports the eight that are left", async ({
  page,
}) => {
  await openTwoDocuments(page);
  await deleteTwoPages(page);
  await viewFirstPage(page);
  await drawAndPlaceSignature(page);
  await expect(page.getByTestId("annotation-image")).toHaveCount(1);

  const pending = page.waitForEvent("download");
  await page.keyboard.press(`${MOD}+e`);
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByText("Exported 8 pages")).toBeVisible();

  const out = await PDFDocument.load(await readFile(await download.path()));
  expect(out.getPageCount()).toBe(8);
  // a's pages 0, 2, 4 (400, 402, 404pt wide) followed by all five of b's.
  expect(out.getPages().map((p) => p.getWidth())).toEqual([400, 402, 404, 400, 401, 402, 403, 404]);
  // The signature was placed on the first page, so that page alone gained an image XObject.
  const xobjects = out.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"));
  expect(xobjects?.toString()).toContain("Image");
});

test("keeps the edited document after a reload", async ({ page }) => {
  await openTwoDocuments(page);
  await deleteTwoPages(page);
  await page.waitForTimeout(AUTOSAVE_MS);

  await page.reload();
  await expect(page.getByTestId("thumbnail")).toHaveCount(8);
});

test("refuses a password-protected PDF and stays on the home screen", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("file-input")
    .setInputFiles([pdfFile("locked.pdf", await makeEncryptedPdf())]);

  await expect(page.getByText(/password protected/)).toBeVisible();
  await expect(page).toHaveURL("/");
});
