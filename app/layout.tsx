import type React from "react"
import type { Metadata } from "next"
import { Mona_Sans as FontSans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import Header from "@/components/header"
import { Toaster } from "@/components/ui/toaster"
import { WebRTCProvider } from "@/contexts/WebRTCContext";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "ConnectShare - P2P File Sharing",
  description: "Direct peer-to-peer file sharing using WebRTC technology",
  keywords: ["file sharing", "p2p", "webrtc", "peer-to-peer"],
  authors: [{ name: "ConnectShare Team" }],
};
export const viewport = "width=device-width, initial-scale=1";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="connectshare-theme">
          <WebRTCProvider>
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          </WebRTCProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
