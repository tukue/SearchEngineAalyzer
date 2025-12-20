<<<<<<< HEAD
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Meta Tag Analyzer",
  description: "Analyze and validate meta tags from any website in real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
=======
import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Search Engine Analyzer (Next.js)",
  description: "Experimental Next.js app shell for the Search Engine Analyzer UI.",
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
>>>>>>> origin/main
}
