// /admin — operator console. Kept out of search engines and styled as the
// dark sibling of the site's terminal mode (same warm near-black + bone +
// green palette, JetBrains Mono throughout).

import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--admin-mono",
});

export const metadata: Metadata = {
  title: "ouss-admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={mono.variable}
      style={{
        minHeight: "100dvh",
        background: "#090A06",
        color: "#E8E6DB",
        fontFamily: "var(--admin-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}
