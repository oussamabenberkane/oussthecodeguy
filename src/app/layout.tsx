import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = "https://oussthecodeguy.dev";
const TITLE = "Oussama Bendou — Backend & Full-Stack Engineer";
const DESC =
  "Backend and full-stack engineer based in Algeria — Spring Boot systems, React interfaces, and AI-integrated products. Available for remote work globally.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(SITE),
  alternates: { canonical: "/" },
  keywords: [
    "Oussama Bendou",
    "oussthecodeguy",
    "software engineer",
    "backend engineer",
    "full stack developer",
    "Java",
    "Spring Boot",
    "TypeScript",
    "React",
    "Next.js",
    "Django",
    "Python",
    "PostgreSQL",
    "AWS",
    "Algeria",
    "Béjaïa",
    "remote engineer",
    "AI integration",
    "product engineer",
    "portfolio",
  ],
  authors: [{ name: "Oussama Bendou", url: SITE }],
  creator: "Oussama Bendou",
  openGraph: {
    title: TITLE,
    description: DESC,
    url: SITE,
    siteName: "oussthecodeguy",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Oussama Bendou — Backend & Full-Stack Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    creator: "@oussthecodeguy",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4EDD8" },
    { media: "(prefers-color-scheme: dark)", color: "#1E1E2E" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className="min-h-full"
        style={{ background: "#1A1A18", color: "#F4EDD8" }}
      >
        {children}
      </body>
    </html>
  );
}
