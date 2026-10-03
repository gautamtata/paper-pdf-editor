# Paper

Paper is a private, local-first PDF editor that runs entirely in your browser. Open one or more PDFs, rearrange and clean up their pages, annotate and sign them, and export a single flattened file. Nothing is ever uploaded, and no account is needed.

Production: https://pdf.gautamtata.com (also https://paper-pdf-editor.vercel.app) · Source: https://github.com/gautamtata/paper-pdf-editor

## Privacy model

- Every operation (parsing, rendering, editing, signing, exporting) happens on your device in client-side JavaScript. The deployed app is static assets only: there are no route handlers, server actions, or upload endpoints.
- The only persistence is your browser's IndexedDB: recent documents, the autosaved workspace, and the signature vault.
- "Clear all local data" wipes everything Paper has stored and returns you to a clean slate.

## Features

- Open and merge PDFs (drag-and-drop or file picker)
- Delete, reorder, and rotate pages
- Annotate with text, pen, highlight, and rectangle tools
- Sign by drawing, typing, or uploading an image, with a local signature vault for reuse
- Export a flattened PDF with all edits applied
- Autosave and reload the workspace between sessions

## Scripts

Paper uses [Bun](https://bun.sh). Install dependencies with `bun install`; a `postinstall` hook copies the pdf.js worker into `public/`.

| Script              | What it does                             |
| ------------------- | ---------------------------------------- |
| `bun run dev`       | Start the Next.js dev server             |
| `bun run build`     | Production build                         |
| `bun run test`      | Unit tests (Vitest)                      |
| `bun run e2e`       | End-to-end tests (Playwright, in `e2e/`) |
| `bun run typecheck` | `tsc --noEmit`                           |
| `bun run lint`      | ESLint                                   |

Set `PLAYWRIGHT_BASE_URL=https://...` to run the e2e suite against a deployed URL instead of a local dev server.

## Deployment

Deployed to Vercel with framework auto-detection and no environment variables or integrations.

The design spec and implementation plan live in `docs/superpowers/`.
