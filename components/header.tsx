"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ModeToggle } from "./mode-toggle"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Settings, Menu, Wifi, WifiOff } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { useWebRTC } from "@/contexts/WebRTCContext"

const navItems = [
  { name: "Home", path: "/" },
  { name: "Share", path: "/share" },
  { name: "Receive", path: "/receive" },
  { name: "Peers", path: "/peers" },
]

export default function Header() {
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isSignalingConnected, localPeer } = useWebRTC();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    setMounted(true)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  if (!mounted) return (
    <header className="sticky top-0 z-50 w-full border-b border-transparent bg-background">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
                <div className="size-8 text-primary animate-pulse bg-muted rounded-full"></div>
                <div className="h-6 w-24 md:w-32 bg-muted rounded animate-pulse"></div>
            </div>
             <div className="ml-4 flex items-center gap-1 text-xs">
                <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
                <div className="h-4 w-10 bg-muted rounded animate-pulse hidden sm:inline"></div>
            </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item, index) => (
            <div key={index} className="relative">
              <div className="h-5 w-12 sm:w-16 bg-muted rounded animate-pulse"></div>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="h-9 w-9 bg-muted rounded-full animate-pulse"></div>
          <div className="hidden md:block">
            <div className="h-9 w-9 bg-muted rounded-full animate-pulse"></div>
          </div>
          <div className="md:hidden">
             <div className="h-9 w-9 bg-muted rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </header>
  );

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b transition-all duration-200",
      scrolled
        ? "border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        : "border-transparent bg-background",
    )}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: mounted ? 360 : 0 }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear", repeatDelay: 10 }}
              className="size-8 text-primary"
            >
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  fillRule="evenodd" clipRule="evenodd"
                  d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z"
                  fill="currentColor"
                ></path>
              </svg>
            </motion.div>
            <span className="text-xl font-bold tracking-tight">ConnectShare</span>
          </Link>
          <div className="ml-4 flex items-center gap-1 text-xs">
            {isSignalingConnected ? (
              <><Wifi className="h-4 w-4 text-green-500" /> <span className="text-green-500 hidden sm:inline">Online</span></>
            ) : (
              <><WifiOff className="h-4 w-4 text-red-500" /> <span className="text-red-500 hidden sm:inline">Offline</span></>
            )}
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <div key={item.path} className="relative" onMouseEnter={() => setIsHovered(item.path)} onMouseLeave={() => setIsHovered(null)}>
              <Link href={item.path} className={cn("text-sm font-medium transition-colors hover:text-primary", pathname === item.path ? "text-primary" : "text-muted-foreground")}>
                {item.name}
              </Link>
              {isHovered === item.path && (
                <motion.div layoutId="nav-indicator" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
              )}
              {pathname === item.path && !isHovered && ( <motion.div layoutId="nav-indicator" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary" /> )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ModeToggle />
          <Link href="/settings" className="hidden md:block">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" /> <span className="sr-only">Settings</span>
            </Button>
          </Link>
          {isSignalingConnected && localPeer && (
            <Avatar className="hidden md:block">
              <AvatarImage src={`https://avatar.vercel.sh/${localPeer.id}.png`} alt={localPeer.name} />
              <AvatarFallback>{localPeer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" /> <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
                side="right" 
                className="w-[80vw] sm:w-[350px]" 
                aria-labelledby="mobile-menu-title"
                {...({} as any)}
            >
              <SheetHeader className="mb-6">
                <SheetTitle id="mobile-menu-title" className="flex items-center gap-2">
                  <div className="size-6 text-primary">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z" fill="currentColor" ></path>
                    </svg>
                  </div>
                  ConnectShare
                </SheetTitle>
                <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4">
                {isSignalingConnected && localPeer && (
                  <div className="flex items-center gap-3 mb-6">
                    <Avatar>
                      <AvatarImage src={`https://avatar.vercel.sh/${localPeer.id}.png`} alt={localPeer.name} />
                      <AvatarFallback>{localPeer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{localPeer.name}</p>
                      <p className="text-sm text-muted-foreground">ID: {localPeer.id.substring(0, 6)}...</p>
                    </div>
                  </div>
                )}
                {navItems.map((item) => (
                  <Link key={item.path} href={item.path} className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                    pathname === item.path 
                      ? "bg-primary/10 text-primary border-l-2 border-primary" 
                      : "hover:bg-muted text-muted-foreground"
                  )}>
                    {pathname === item.path && (
                      <motion.div
                        layoutId="mobile-nav-indicator"
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                    {item.name}
                  </Link>
                ))}
                <Link href="/settings" className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                  pathname === "/settings" 
                    ? "bg-primary/10 text-primary border-l-2 border-primary" 
                    : "hover:bg-muted text-muted-foreground"
                )}>
                  {pathname === "/settings" && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <Settings className="h-4 w-4" /> Settings
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}