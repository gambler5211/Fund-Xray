import type { Metadata, Viewport } from "next";
// Fonts are self-hosted from npm (no build-time call to Google Fonts).
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/500.css";
import "@fontsource/source-sans-3/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fund X-Ray",
  description: "A weekly X-ray of where your money sits and which sectors it is leaving.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
};

// Runs before paint so the saved theme never flashes the wrong colours.
const themeScript = `(function(){try{var t=localStorage.getItem('fx-theme');if(t!=='day'&&t!=='night'){t='day'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='day'}})();`;

/** Root layout: fonts, tokens and theme only. Page chrome lives in the (app) and (public) groups. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="day" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink">{children}</body>
    </html>
  );
}
