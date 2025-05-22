"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { ArrowRight, FileUp, Download, Users, Zap } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

export default function Home() {
  const { theme } = useTheme()

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const features = [
    {
      icon: <FileUp className="h-10 w-10" />,
      title: "Share Files",
      description: "Easily share files with peers directly from your browser",
      link: "/share",
    },
    {
      icon: <Download className="h-10 w-10" />,
      title: "Receive Files",
      description: "Receive files from connected peers securely",
      link: "/receive",
    },
    {
      icon: <Users className="h-10 w-10" />,
      title: "Discover Peers",
      description: "Find and connect with peers on your network",
      link: "/peers",
    },
  ]

  return (
    <div className="container px-4 py-10 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center text-center mb-16"
      >
        <div className="relative mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.2,
            }}
            className="size-24 text-primary"
          >
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z"
                fill="currentColor"
              ></path>
            </svg>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="absolute -bottom-2 -right-2 bg-secondary rounded-full p-2"
          >
            <Zap className="h-6 w-6 text-primary" />
          </motion.div>
        </div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-4xl md:text-6xl font-bold tracking-tight mb-4"
        >
          ConnectShare
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-xl text-muted-foreground max-w-2xl"
        >
          Direct peer-to-peer file sharing using WebRTC. No servers, no limits, just seamless connections.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-wrap gap-4 mt-8 justify-center"
        >
          <Link href="/share">
            <Button size="lg" className="gap-2">
              Start Sharing <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/peers">
            <Button size="lg" variant="outline" className="gap-2">
              Discover Peers <Users className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
      >
        {features.map((feature, index) => (
          <motion.div key={index} variants={item}>
            <Link href={feature.link} className="block h-full">
              <Card className="h-full overflow-hidden border border-border/50 transition-all duration-300 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5">
                <CardContent className="p-6 flex flex-col items-center text-center h-full">
                  <div className="mb-4 p-3 rounded-full bg-primary/10 text-primary">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground mb-4">{feature.description}</p>
                  <div className="mt-auto pt-4">
                    <Button variant="ghost" className="gap-2 group">
                      Learn More <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
