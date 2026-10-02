import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Everything is same-origin: the app, the pdf.js worker, the signature font. Next's bootstrap
 * scripts are inline, so `script-src` allows them; `unsafe-eval` is for dev-mode HMR only.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  headers: () =>
    Promise.resolve([
      { source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
    ]),
};

export default nextConfig;
