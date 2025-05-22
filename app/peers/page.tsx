"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Search, UserCheck, UserX, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type PeerStatus = "available" | "connected" | "busy"

type Peer = {
  id: string
  name: string
  status: PeerStatus
  avatar: string
}

export default function PeersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [peers, setPeers] = useState<Peer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()

  // Mock data for demonstration
  const fetchPeers = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // In a real app, this would be replaced with WebRTC peer discovery
      const mockPeers: Peer[] = [
        {
          id: "peer-123",
          name: "Alex's Device",
          status: "available",
          avatar: "/placeholder.svg?height=40&width=40",
        },
        {
          id: "peer-456",
          name: "Sarah's Laptop",
          status: "available",
          avatar: "/placeholder.svg?height=40&width=40",
        },
        {
          id: "peer-789",
          name: "Meeting Room",
          status: "available",
          avatar: "/placeholder.svg?height=40&width=40",
        },
        {
          id: "peer-012",
          name: "John's Phone",
          status: "connected",
          avatar: "/placeholder.svg?height=40&width=40",
        },
        {
          id: "peer-345",
          name: "Conference Room",
          status: "busy",
          avatar: "/placeholder.svg?height=40&width=40",
        },
      ]

      setPeers(mockPeers)
    } catch (err) {
      setError("Failed to load peers. Please try again.")
      toast({
        title: "Error",
        description: "Failed to load peers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPeers()
  }, [])

  const refreshPeers = () => {
    setIsRefreshing(true)
    fetchPeers()
  }

  const filteredPeers = peers.filter((peer) => peer.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const availablePeers = filteredPeers.filter((peer) => peer.status === "available")
  const connectedPeers = filteredPeers.filter((peer) => peer.status === "connected")
  const busyPeers = filteredPeers.filter((peer) => peer.status === "busy")

  const handleConnect = (peerId: string) => {
    setPeers(peers.map((peer) => (peer.id === peerId ? { ...peer, status: "connected" } : peer)))

    toast({
      title: "Connected",
      description: `Successfully connected to ${peers.find((p) => p.id === peerId)?.name}`,
      variant: "default",
    })
  }

  const handleDisconnect = (peerId: string) => {
    setPeers(peers.map((peer) => (peer.id === peerId ? { ...peer, status: "available" } : peer)))

    toast({
      title: "Disconnected",
      description: `Disconnected from ${peers.find((p) => p.id === peerId)?.name}`,
      variant: "default",
    })
  }

  const getStatusIcon = (status: PeerStatus) => {
    switch (status) {
      case "available":
        return <Wifi className="h-4 w-4" />
      case "connected":
        return <UserCheck className="h-4 w-4" />
      case "busy":
        return <WifiOff className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: PeerStatus) => {
    switch (status) {
      case "available":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      case "connected":
        return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
      case "busy":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
    }
  }

  const PeerItem = ({ peer }: { peer: Peer }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between p-4 border-b last:border-b-0 border-border/50 group"
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-12 w-12 border border-border/50">
          <AvatarImage src={peer.avatar || "/placeholder.svg"} alt={peer.name} />
          <AvatarFallback>{peer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">{peer.name}</h3>
            <Badge variant="outline" className={`${getStatusColor(peer.status)} text-xs px-2 py-0 h-5`}>
              <span className="flex items-center gap-1">
                {getStatusIcon(peer.status)}
                <span className="capitalize">{peer.status}</span>
              </span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{peer.id}</p>
        </div>
      </div>
      <div>
        {peer.status === "available" ? (
          <Button
            size="sm"
            onClick={() => handleConnect(peer.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100"
          >
            Connect
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDisconnect(peer.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100"
          >
            Disconnect
          </Button>
        )}
      </div>
    </motion.div>
  )

  const PeerSectionSkeleton = () => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-7 w-32" />
      </div>
      <Card>
        <CardContent className="p-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b last:border-b-0 border-border/50">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  const PeerSection = ({ title, peers, icon }: { title: string; peers: Peer[]; icon: React.ReactNode }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1 rounded-md bg-primary/10 text-primary">{icon}</div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <Badge variant="outline" className="ml-2">
          {peers.length}
        </Badge>
      </div>
      <Card>
        <CardContent className="p-0">
          <AnimatePresence>
            {peers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 text-center text-muted-foreground"
              >
                No peers found
              </motion.div>
            ) : (
              peers.map((peer) => <PeerItem key={peer.id} peer={peer} />)
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="container py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Discoverable Peers</h1>
            <p className="text-muted-foreground mt-2">Find and connect with peers on your network</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPeers}
            disabled={isLoading || isRefreshing}
            className="gap-2"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: isRefreshing ? Number.POSITIVE_INFINITY : 0, ease: "linear" }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
            Refresh
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for peers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </motion.div>

      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <>
          <PeerSectionSkeleton />
          <PeerSectionSkeleton />
          <PeerSectionSkeleton />
        </>
      ) : (
        <>
          <PeerSection title="Available Peers" peers={availablePeers} icon={<Wifi className="h-5 w-5" />} />
          <PeerSection title="Connected Peers" peers={connectedPeers} icon={<UserCheck className="h-5 w-5" />} />
          <PeerSection title="Busy Peers" peers={busyPeers} icon={<UserX className="h-5 w-5" />} />
        </>
      )}
    </div>
  )
}
