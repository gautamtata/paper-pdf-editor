import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "pdf.worker.min.mjs");

await mkdir(path.dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`copied pdf.js worker -> ${path.relative(process.cwd(), dest)}`);
