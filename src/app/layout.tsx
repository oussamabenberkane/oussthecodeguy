import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = "https://oussamabenberkane.com";
const TITLE = "Oussama Benberkane — Backend & Full-Stack Engineer";
const DESC =
  "Backend and full-stack engineer based in Algeria — Spring Boot systems, React interfaces, and AI-integrated products. Available for remote work globally.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(SITE),
  alternates: { canonical: "/" },
  keywords: [
    "Oussama Benberkane",
    "oussamabenberkane",
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
  authors: [{ name: "Oussama Benberkane", url: SITE }],
  creator: "Oussama Benberkane",
  openGraph: {
    title: TITLE,
    description: DESC,
    url: SITE,
    siteName: "oussamabenberkane.com",
    locale: "en_US",
    type: "website",
    images: [
      { 
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Oussama Benberkane — Backend & Full-Stack Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    creator: "@oussamabenberkane",
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
    { media: "(prefers-color-scheme: light)", color: "#ECEBE4" },
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
        style={{ background: "#161512", color: "#ECEBE4" }}
      >
        {children}
      </body>
    </html>
  );
}
