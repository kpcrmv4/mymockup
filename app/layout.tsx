import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MockMeup — Device mockup generator",
  description:
    "Drop, paste or upload a screenshot, wrap it in a beautiful device frame, and download a PNG. 100% in your browser — nothing is uploaded.",
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "MockMeup — Device mockup generator",
    description:
      "Turn screenshots into polished device mockups, right in your browser.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08080f",
};

// Applied before paint to avoid a light/dark flash.
// Defaults to the dark "glass" style; light is opt-in via the toggle and persists.
const themeInit = `(function(){try{var t=localStorage.getItem('mockmeup-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
