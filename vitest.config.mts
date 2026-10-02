import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.tsx",
      "test/**/*.test.ts",
    ],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // The modern pdf.js build needs newer JS built-ins than Node 22 ships.
      "pdfjs-dist": "pdfjs-dist/legacy/build/pdf.mjs",
    },
  },
});
