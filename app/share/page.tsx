"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileIcon, X, Check, AlertCircle, Trash2, Users, Send, ServerCrash, Loader2, FileText, FileImage, FileArchive, FileAudio, FileVideo } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"
import { cn, formatFileSize, generateId } from "@/lib/utils"
import { useWebRTC, UIPeer, UIFileTransfer } from "@/contexts/WebRTCContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

type FileWithLocalId = {
  file: File
  localId: string
}

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return <FileImage className="h-5 w-5" />
  if (type.startsWith("video/")) return <FileVideo className="h-5 w-5" />
  if (type.startsWith("audio/")) return <FileAudio className="h-5 w-5" />
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz")) return <FileArchive className="h-5 w-5" />
  if (type.includes("pdf") || type.includes("doc") || type.includes("txt")) return <FileText className="h-5 w-5" />
  return <FileIcon className="h-5 w-5" />
}

export default function SharePage() {
  const [selectedFiles, setSelectedFiles] = useState<FileWithLocalId[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  
  const { peers: contextPeers, sendFile, activeTransfers, localPeer, isSignalingConnected } = useWebRTC();
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);

  const shareablePeers = useMemo(() => 
    contextPeers.filter(p => p.status === 'connected' && p.id !== localPeer?.id),
    [contextPeers, localPeer]
  );

  useEffect(() => {
    if (selectedPeerId && !shareablePeers.find(p => p.id === selectedPeerId)) {
      setSelectedPeerId(null);
      toast({
        title: "Selected Peer Unavailable",
        description: "The previously selected peer is no longer connected.",
        variant: "destructive",
      });
    }
  }, [shareablePeers, selectedPeerId, toast]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (dropAreaRef.current && !dropAreaRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files)
    }
  }, [])

  const handleFileSelection = (fileList: FileList) => {
    const newFiles = Array.from(fileList).map((file) => ({
      file,
      localId: generateId(),
    }))
    setSelectedFiles((prev) => [...prev, ...newFiles])
    toast({
      title: "Files added",
      description: `${newFiles.length} file(s) ready to be shared.`,
    })
  }

  const removeFile = (localId: string) => {
    setSelectedFiles((files) => files.filter((f) => f.localId !== localId))
  }

  const clearAllFiles = () => {
    setSelectedFiles([])
    toast({ title: "Files cleared", description: "All selected files have been removed." })
  }

  const handleBrowseFiles = () => fileInputRef.current?.click();

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files)
      e.target.value = ""
    }
  }

  const handleStartSharing = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", description: "Please select files to share.", variant: "destructive" });
      return;
    }
    if (!selectedPeerId) {
      toast({ title: "No peer selected", description: "Please select a peer to share with.", variant: "destructive" });
      return;
    }
    const peer = shareablePeers.find(p => p.id === selectedPeerId);
    if (!peer) {
      toast({ title: "Peer not found", description: "Selected peer is no longer available.", variant: "destructive" });
      return;
    }

    setIsSharing(true);
    
    try {
      let filesSentCount = 0;
      selectedFiles.forEach(fileWithLocalId => {
        const transferId = sendFile(selectedPeerId, fileWithLocalId.file);
        filesSentCount++;
      });

      if (filesSentCount > 0) {
        toast({ title: "Sharing Initiated", description: `Attempting to share ${filesSentCount} file(s) with ${peer.name}.` });
        setSelectedFiles([]);
        setSelectedPeerId(null);
      }
    } finally {
      // Add a small delay to show the loading state
      setTimeout(() => setIsSharing(false), 1000);
    }
  }

  const sendingTransfers = useMemo(() => 
    activeTransfers.filter(t => t.direction === 'send' && (t.status === 'pending' || t.status === 'transferring' || t.status === 'waiting_acceptance')),
    [activeTransfers]
  );

  if (!isSignalingConnected) {
    return (
      <div className="container py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <ServerCrash className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Not Connected to Sharing Service</h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          To share files, you need to be connected. Please go to settings to connect.
        </p>
        <Link href="/settings">
          <Button size="lg">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Share Files</h1>
        <p className="text-muted-foreground mt-2">Select files to share with your peers</p>
      </motion.div>

      {/* File Drop Area */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="mb-8">
          <CardContent className="p-0">
            <div
              ref={dropAreaRef}
              className={cn(
                "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg transition-all duration-300",
                isDragging ? "border-primary bg-primary/5 file-drop-area drag-active" : "border-border file-drop-area",
              )}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: isDragging ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {isDragging ? "Drop files here" : "Drag & drop files here"}
                </h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  or select files from your device to share with connected peers
                </p>
                <Button onClick={handleBrowseFiles} className="mt-2">
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Staged Files Display */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Staged Files ({selectedFiles.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={clearAllFiles} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-60 overflow-y-auto">
                  {selectedFiles.map((fileWithId, index) => (
                    <motion.div
                      key={fileWithId.localId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 border-b last:border-b-0 border-border/50 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                          {getFileIcon(fileWithId.file.type)}
                        </div>
                        <div>
                          <h3 className="font-medium truncate max-w-[200px] sm:max-w-[300px]">{fileWithId.file.name}</h3>
                          <p className="text-sm text-muted-foreground">{formatFileSize(fileWithId.file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileWithId.localId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Peer Selection */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mb-6"
      >
        <Select onValueChange={setSelectedPeerId} value={selectedPeerId || undefined}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Select a peer to share with" />
          </SelectTrigger>
          <SelectContent>
            {shareablePeers.length === 0 && (
              <SelectItem value="no-peers-available" disabled>
                {contextPeers.length === 0 ? "No peers discovered" : "No connected peers available"}
              </SelectItem>
            )}
            {shareablePeers.map((peer) => (
              <SelectItem key={peer.id} value={peer.id}>
                {peer.name} ({peer.id.substring(0, 6)}...)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Share Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex flex-col sm:flex-row justify-end gap-4 mb-8"
      >
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSharing}
          className="sm:order-1"
        >
          Add More Files
        </Button>

        <Button 
          onClick={handleStartSharing} 
          disabled={selectedFiles.length === 0 || !selectedPeerId || isSharing} 
          className="gap-2 sm:order-2"
        >
          {isSharing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Initiating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Share with {shareablePeers.find(p => p.id === selectedPeerId)?.name || "Selected Peer"}
            </>
          )}
        </Button>
      </motion.div>

      {/* Currently Sending Section */}
      <AnimatePresence>
        {sendingTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Currently Sending ({sendingTransfers.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <AnimatePresence>
                  {sendingTransfers.map((transfer) => (
                    <motion.div
                      key={transfer.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b last:border-b-0 border-border/50"
                    >
                      <div className="flex items-center gap-4 mb-2 sm:mb-0">
                        <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                          {getFileIcon(transfer.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium">{transfer.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                            <span>{formatFileSize(transfer.size)}</span>
                            <span>•</span>
                            <span>To: {transfer.peerName}</span>
                            <span>•</span>
                            <span className="capitalize">
                              {transfer.status === 'waiting_acceptance' ? 'Pending acceptance' : 
                               transfer.status === 'transferring' ? `Transferring ${transfer.progress.toFixed(0)}%` :
                               transfer.status}
                            </span>
                          </div>
                          {transfer.status === "transferring" && (
                            <Progress value={transfer.progress} className="w-full sm:w-48 h-2 mt-1 bg-secondary" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {shareablePeers.length === 0 && selectedFiles.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Connected Peers</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            {contextPeers.length === 0 
              ? "No peers have been discovered yet. Try refreshing the peer list or check your connection."
              : "No peers are currently connected. Connect to peers first to start sharing files."
            }
          </p>
          <div className="flex gap-2">
            <Link href="/peers">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" /> View Peers
              </Button>
            </Link>
            {!isSignalingConnected && (
              <Link href="/settings">
                <Button className="gap-2">
                  Connect to Service
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}