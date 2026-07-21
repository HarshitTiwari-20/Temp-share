import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
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
  title: {
    default: "TempShare — Share Code. Text. Files. Instantly.",
    template: "%s · TempShare",
  },
  description:
    "Real-time temporary sharing for code, text, and files. No accounts. Instant rooms. Automatic expiration.",
  keywords: [
    "pastebin",
    "code share",
    "file transfer",
    "collaborative editor",
    "temporary share",
  ],
  authors: [{ name: "TempShare" }],
  openGraph: {
    title: "TempShare — Share Code. Text. Files. Instantly.",
    description:
      "Real-time temporary sharing for code, text, and files. No accounts required.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c12" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
