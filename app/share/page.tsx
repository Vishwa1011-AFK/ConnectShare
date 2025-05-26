"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, File as FileIcon, X, Check, AlertCircle, Trash2, Users, Send, ServerCrash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { FileCard } from "@/components/file-card"
import { cn, formatFileSize, generateId } from "@/lib/utils"
import { useWebRTC, UIPeer, UIFileTransfer } from "@/contexts/WebRTCContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

type FileWithLocalId = {
  file: File
  localId: string
}

export default function SharePage() {
  const [selectedFiles, setSelectedFiles] = useState<FileWithLocalId[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  
  const { peers: contextPeers, sendFile, activeTransfers, localPeer, isSignalingConnected, connectSignaling } = useWebRTC();
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
      description: `${newFiles.length} file(s) ready to be shared. Select a peer.`,
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

  const handleStartSharing = () => {
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

    let filesSentCount = 0;
    selectedFiles.forEach(fileWithLocalId => {
      const transferId = sendFile(selectedPeerId, fileWithLocalId.file);
      filesSentCount++;
    });

    if (filesSentCount > 0) {
        toast({ title: "Sharing Initiated", description: `Attempting to share ${filesSentCount} file(s) with ${peer.name}. Check transfer status below or on the transfer page.` });
        setSelectedFiles([]);
        setSelectedPeerId(null);
    }
  }
  
  const getTransferStatusForFile = (fileLocalId: string, peerId: string | null): UIFileTransfer | undefined => {
    if (!peerId) return undefined;
    return activeTransfers.find(t => t.fileId === fileLocalId && t.peerId === peerId && t.direction === 'send');
  };

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

  const sendingTransfers = useMemo(() => 
    activeTransfers.filter(t => t.direction === 'send' && t.status !== 'completed' && t.status !== 'rejected'),
    [activeTransfers]
  );
  
  const completedSentTransfers = useMemo(() =>
    activeTransfers.filter(t => t.direction === 'send' && (t.status === 'completed' || t.status === 'rejected')),
    [activeTransfers]
  );

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

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="mb-4">
          <Select onValueChange={setSelectedPeerId} value={selectedPeerId || undefined}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Select a peer to share with" />
            </SelectTrigger>
            <SelectContent>
              {shareablePeers.length === 0 && (
                <SelectItem value="no-peers-available" disabled>
                  No connected peers available
                </SelectItem>
              )}
              {shareablePeers.map((peer) => (
                <SelectItem key={peer.id} value={peer.id}>
                  {peer.name} ({peer.id.substring(0, 6)}...)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex flex-col sm:flex-row justify-end gap-4 mt-6"
      >
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendingTransfers.length > 0}
          className="sm:order-1"
        >
          Add More Files
        </Button>

        <Button onClick={handleStartSharing} disabled={selectedFiles.length === 0 || !selectedPeerId} className="gap-2 sm:order-2">
          <Send className="h-4 w-4" /> Share with {shareablePeers.find(p => p.id === selectedPeerId)?.name || "Selected Peer"}
        </Button>
      </motion.div>
    </div>
  )
}