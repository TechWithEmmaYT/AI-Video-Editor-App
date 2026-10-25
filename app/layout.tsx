import type { Metadata } from "next"
import { Fredoka, Geist_Mono, Inter, Inter_Tight } from "next/font/google"
import { cn } from "cn"

import "./globals.css"
// After globals.css so brand tokens override the shadcn defaults.
import "./brand.css"

import { Providers } from "@/components/providers"
import { APP_NAME } from "@/lib/brand"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" })
const fredoka = Fredoka({ subsets: ["latin"], weight: ["700"], variable: "--font-logo" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A video editor your Claude Code can drive.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        inter.variable,
        interTight.variable,
        fredoka.variable,
        geistMono.variable
      )}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
