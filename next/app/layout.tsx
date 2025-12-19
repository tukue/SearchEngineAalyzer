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
}
