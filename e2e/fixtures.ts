import { readFile } from "node:fs/promises";
import path from "node:path";

/** The unit suite's PDF builders, so the browser tests feed the app exactly the same bytes. */
export { makePdf } from "@/test/pdf-fixtures";

/**
 * The committed encrypted fixture. Playwright loads specs as CommonJS, so this resolves the path
 * from `__dirname` rather than `import.meta.url`.
 */
export const makeEncryptedPdf = async (): Promise<Uint8Array> =>
  new Uint8Array(await readFile(path.join(__dirname, "../test/fixtures/encrypted.pdf")));
