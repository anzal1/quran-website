import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://quran-lens.vercel.app",
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Quran Lens",
  title: {
    default: "Quran Lens",
    template: "%s | Quran Lens",
  },
  description:
    "Ask natural questions, read cited Quran verses, and explore connected themes with evidence-first AI guidance.",
  keywords: [
    "Quran",
    "Quran search",
    "Islamic app",
    "semantic search",
    "Quran AI",
    "Quran reflection",
    "Tafsir companion",
  ],
  authors: [{ name: "Quran Lens" }],
  creator: "Quran Lens",
  publisher: "Quran Lens",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Quran Lens",
    title: "Quran Lens",
    description:
      "Evidence-first Quran search with grounded answers, citations, and theme exploration.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Quran Lens interface preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quran Lens",
    description:
      "Ask, read, and verify Quran answers through cited verses and connected themes.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#123C36",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
