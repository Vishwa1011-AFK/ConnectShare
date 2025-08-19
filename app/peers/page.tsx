"use client";

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Search, UserCheck, UserX, Wifi, WifiOff, RefreshCw, UserPlus, LogIn, Loader2, Users } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useWebRTC, UIPeer, PeerStatus as ContextPeerStatus } from "@/contexts/WebRTCContext"
import Link from "next/link"
import { Input } from "@/components/ui/input";

export default function PeersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [connectingPeers, setConnectingPeers] = useState<Set<string>>(new Set())
  const { 
    peers: contextPeers, 
    initiateConnection, 
    localPeer, 
    isSignalingConnected, 
    connectSignaling,
    disconnectPeer,
    requestPeerList
  } = useWebRTC();
  
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(!isSignalingConnected && !localPeer);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(!isSignalingConnected && !localPeer);
  }, [isSignalingConnected, localPeer]);
  
  useEffect(() => {
    if (isSignalingConnected && localPeer) {
      requestPeerList();
    }
  }, [isSignalingConnected, localPeer, requestPeerList]);

  const refreshPeersList = () => {
    if (!isSignalingConnected || !localPeer) {
        toast({ title: "Not Connected", description: "Connection not fully established yet. Please wait.", variant: "destructive"});
        return;
    }
    requestPeerList();
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000); 
  };

  const handleConnectToSignaling = () => {
    const savedSettings = JSON.parse(localStorage.getItem("connectshare-settings") || "{}");
    const displayName = savedSettings.displayName;
    if (displayName) {
      connectSignaling(displayName);
    } else {
      toast({
        title: "Display Name Needed",
        description: "Please set your display name in Settings first.",
        variant: "destructive",
        action: <Button onClick={() => window.location.href = '/settings'}>Go to Settings</Button>
      });
    }
  };
  
  const uiPeers = useMemo(() => {
    return contextPeers.filter(p => p.id !== localPeer?.id);
  }, [contextPeers, localPeer]);

  const filteredPeers = useMemo(() => 
    uiPeers.filter((peer) => peer.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [uiPeers, searchQuery]
  );

  const availablePeers = filteredPeers.filter((peer) => peer.status === "available")
  const connectingPeersFiltered = filteredPeers.filter((peer) => peer.status === "connecting")
  const connectedPeers = filteredPeers.filter((peer) => peer.status === "connected")
  const failedOrDisconnectedPeers = filteredPeers.filter((peer) => peer.status === "failed" || peer.status === "disconnected");

  const handleConnect = (peerId: string) => {
    const peerToConnect = uiPeers.find(p => p.id === peerId);
    if (peerToConnect) {
        setConnectingPeers(prev => new Set(prev).add(peerId));
        initiateConnection(peerId);
        toast({
          title: "Connecting...",
          description: `Attempting to connect to ${peerToConnect.name}`,
        });
        
        // Remove from connecting state after a timeout
        setTimeout(() => {
          setConnectingPeers(prev => {
            const newSet = new Set(prev);
            newSet.delete(peerId);
            return newSet;
          });
        }, 10000);
    }
  };

  const handleDisconnectPeer = (peerId: string) => {
    disconnectPeer(peerId);
    toast({
      title: "Disconnecting...",
      description: `Attempting to disconnect from ${peerId}.`,
    });
  };

  const getStatusIcon = (status: ContextPeerStatus) => {
    switch (status) {
      case "available": return <Wifi className="h-4 w-4" />;
      case "connecting": return <RefreshCw className="h-4 w-4 animate-spin" />;
      case "connected": return <UserCheck className="h-4 w-4" />;
      case "disconnected": return <WifiOff className="h-4 w-4" />;
      case "failed": return <UserX className="h-4 w-4" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: ContextPeerStatus) => {
    switch (status) {
      case "available": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "connecting": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "connected": return "bg-teal-500/10 text-teal-500 hover:bg-teal-500/20";
      case "disconnected": return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20";
      case "failed": return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
      default: return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
    }
  };

  const PeerItem = ({ peer }: { peer: UIPeer }) => {
    const isConnecting = connectingPeers.has(peer.id) || peer.status === "connecting";
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between p-4 border-b last:border-b-0 border-border/50 group"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border border-border/50">
            <AvatarImage src={`https://avatar.vercel.sh/${peer.id}.png`} alt={peer.name} />
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
          {peer.status === "available" && (
            <Button
              size="sm"
              onClick={() => handleConnect(peer.id)}
              disabled={isConnecting}
              className="opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100 gap-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Connect
                </>
              )}
            </Button>
          )}
          {(peer.status === "connected" || peer.status === "connecting") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDisconnectPeer(peer.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100 gap-1"
            >
              <UserX className="h-4 w-4"/> Disconnect
            </Button>
          )}
          {(peer.status === "disconnected" || peer.status === "failed") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleConnect(peer.id)}
              disabled={isConnecting}
              className="opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100 gap-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

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
  );

  const PeerSection = ({ title, peers, icon }: { title: string; peers: UIPeer[]; icon: React.ReactNode }) => (
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
                {searchQuery ? `No peers found matching "${searchQuery}"` : "No peers found"}
              </motion.div>
            ) : (
              peers.map((peer) => <PeerItem key={peer.id} peer={peer} />)
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );

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
            onClick={refreshPeersList}
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
          <PeerSection title="Failed/Disconnected" peers={failedOrDisconnectedPeers} icon={<UserX className="h-5 w-5" />} />
        </>
      )}

      {/* Enhanced Empty State */}
      {!isLoading && uiPeers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Peers Discovered</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            {isSignalingConnected 
              ? "No other peers are currently online. Try refreshing or ask others to connect to the service."
              : "You're not connected to the sharing service. Connect first to discover peers."
            }
          </p>
          <div className="flex gap-2">
            {isSignalingConnected ? (
              <Button onClick={refreshPeersList} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh Peers
              </Button>
            ) : (
              <Link href="/settings">
                <Button className="gap-2">
                  <LogIn className="h-4 w-4" /> Connect to Service
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}