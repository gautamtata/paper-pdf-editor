import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@fontsource-variable/caveat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Paper", template: "%s · Paper" },
  description:
    "A private, local-first PDF editor. Your files never leave your device.",
  applicationName: "Paper",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fefcf9" },
    { media: "(prefers-color-scheme: dark)", color: "#110d0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={300} skipDelayDuration={200}>
          {children}
        </TooltipProvider>
        <Toaster
          position="bottom-center"
          gap={8}
          // Clear of the editor's floating toolbar.
          offset={{ bottom: 84 }}
          toastOptions={{
            classNames: {
              toast:
                "!rounded-md !border !border-border !bg-surface-raised !text-foreground !shadow-overlay !font-sans",
              description: "!text-foreground-muted",
              actionButton: "!bg-accent !text-accent-foreground !rounded-sm",
              cancelButton: "!bg-surface-sunken !text-foreground !rounded-sm",
            },
          }}
        />
      </body>
    </html>
  );
}
