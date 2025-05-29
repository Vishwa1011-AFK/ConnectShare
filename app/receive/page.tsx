"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react" 
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { motion, AnimatePresence } from "framer-motion"
import { Download, FileDown, Clock, Users, CheckCircle2, XCircle, AlertTriangle, ServerCrash, Eye, X } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { useWebRTC, UIFileTransfer } from "@/contexts/WebRTCContext"
import { formatFileSize } from "@/lib/utils"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"

interface TransferListItemProps {
  transfer: UIFileTransfer;
  onAccept?: (transferId: string) => void;
  onReject?: (transferId: string) => void;
}

const TransferListItem = React.memo(function TransferListItem({ transfer, onAccept, onReject }: TransferListItemProps) {
  const { toast } = useToast(); 
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSaveFile = (blob: Blob | undefined, fileName: string) => {
    if (!blob) {
      toast({ title: "Error", description: "File data not available for download.", variant: "destructive"});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${fileName} has been saved.`});
  };

  const handlePreviewImage = () => {
    if (transfer.blob && transfer.type.startsWith('image/')) {
      const url = URL.createObjectURL(transfer.blob);
      setPreviewUrl(url);
      setShowPreview(true);
    }
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const isImage = transfer.type.startsWith('image/');

  const getStatusIconAndColor = (status: UIFileTransfer["status"]) => {
    switch (status) {
      case "pending": case "waiting_acceptance": return { icon: <Clock className="h-3 w-3 mr-1" />, color: "bg-yellow-500/10 text-yellow-500" };
      case "transferring": return { icon: <Download className="h-3 w-3 mr-1" />, color: "bg-blue-500/10 text-blue-500" };
      case "completed": return { icon: <CheckCircle2 className="h-3 w-3 mr-1" />, color: "bg-green-500/10 text-green-500" };
      case "rejected": return { icon: <XCircle className="h-3 w-3 mr-1" />, color: "bg-red-500/10 text-red-500" };
      case "error": return { icon: <AlertTriangle className="h-3 w-3 mr-1" />, color: "bg-red-700/10 text-red-700" };
      default: return { icon: <Clock className="h-3 w-3 mr-1" />, color: "bg-gray-500/10 text-gray-500" };
    }
  }
  
  const { icon, color } = getStatusIconAndColor(transfer.status);

  return (
    <>
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
            <FileDown className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">{transfer.name}</h3>
              <Badge variant="outline" className={`${color} hover:${color}`}>
                {icon} {transfer.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>{formatFileSize(transfer.size)}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>From:</span>
                <Avatar className="h-4 w-4 mr-1">
                  <AvatarImage src={`https://avatar.vercel.sh/${transfer.peerId}.png`} alt={transfer.peerName} />
                  <AvatarFallback>{transfer.peerName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{transfer.peerName}</span>
              </div>
            </div>
            {transfer.status === "transferring" && (
              <Progress value={transfer.progress} className="w-full sm:w-32 h-2 mt-1 bg-secondary" />
            )}
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-center">
          {transfer.status === "waiting_acceptance" && onAccept && onReject && (
            <>
              <Button size="sm" onClick={() => onAccept(transfer.id)}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => onReject(transfer.id)}>Reject</Button>
            </>
          )}
          {transfer.status === "completed" && (
            <div className="flex gap-2">
              {isImage && (
                <Button size="sm" variant="outline" className="gap-1" onClick={handlePreviewImage}>
                  <Eye className="h-4 w-4" /> Preview
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => handleSaveFile(transfer.blob, transfer.name)}>
                <Download className="h-4 w-4" /> Save
              </Button>
            </div>
          )}
          {transfer.status === "error" && (
            <Badge variant="destructive">Transfer Failed</Badge>
          )}
        </div>
      </motion.div>

      {/* Image Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>{transfer.name}</span>
              <Button variant="ghost" size="sm" onClick={handleClosePreview}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-2">
            {previewUrl && (
              <div className="flex justify-center">
                <img 
                  src={previewUrl || "/placeholder.svg"} 
                  alt={transfer.name}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  onLoad={() => {
                    // Image loaded successfully
                  }}
                  onError={() => {
                    toast({ title: "Preview Error", description: "Could not load image preview.", variant: "destructive" });
                    handleClosePreview();
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default function ReceivePage() {
  const { activeTransfers, acceptFileOffer, rejectFileOffer, isSignalingConnected } = useWebRTC();
  const { toast } = useToast() 

  const incomingOffers = useMemo(() =>  {
    const offers = activeTransfers.filter(t => t.direction === 'receive' && t.status === 'waiting_acceptance').sort((a,b) => b.timestamp - a.timestamp);
    return offers;
  },[activeTransfers]);

  const receivingFiles = useMemo(() =>
    activeTransfers.filter(t => t.direction === 'receive' && t.status === 'transferring').sort((a,b) => b.timestamp - a.timestamp),
    [activeTransfers]
  );
  const completedFiles = useMemo(() =>
    activeTransfers.filter(t => t.direction === 'receive' && t.status === 'completed').sort((a,b) => b.timestamp - a.timestamp),
    [activeTransfers]
  );
  const rejectedOrErrorFiles = useMemo(() =>
    activeTransfers.filter(t => t.direction === 'receive' && (t.status === 'rejected' || t.status === 'error')).sort((a,b) => b.timestamp - a.timestamp),
    [activeTransfers]
  );

  const handleAcceptFile = useCallback((transferId: string) => {
    acceptFileOffer(transferId); 
    toast({ title: "File accepted", description: "The file transfer will begin shortly." });
  }, [acceptFileOffer, toast]);

  const handleRejectFile = useCallback((transferId: string) => {
    rejectFileOffer(transferId);
    toast({ title: "File rejected", description: "The file transfer has been rejected." });
  }, [rejectFileOffer, toast]);

  if (!isSignalingConnected) {
    return (
      <div className="container py-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <ServerCrash className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Not Connected to Sharing Service</h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          To receive files, you need to be connected. Please go to settings to connect.
        </p>
        <Link href="/settings">
          <Button size="lg">Go to Settings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Receive Files</h1>
        <p className="text-muted-foreground mt-2">Manage incoming file transfers</p>
      </motion.div>

      {incomingOffers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
        >
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-xl">Incoming File Offers ({incomingOffers.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <AnimatePresence>
                {incomingOffers.map((transfer) => <TransferListItem key={transfer.id} transfer={transfer} onAccept={handleAcceptFile} onReject={handleRejectFile} />)}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {receivingFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-xl">Currently Receiving ({receivingFiles.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <AnimatePresence>
                {receivingFiles.map((transfer) => <TransferListItem key={transfer.id} transfer={transfer} />)}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {completedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-xl">Received Files ({completedFiles.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <AnimatePresence>
                {completedFiles.map((transfer) => <TransferListItem key={transfer.id} transfer={transfer} />)}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {rejectedOrErrorFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-xl text-destructive">Rejected/Failed Transfers ({rejectedOrErrorFiles.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <AnimatePresence>
                {rejectedOrErrorFiles.map((transfer) => <TransferListItem key={transfer.id} transfer={transfer} />)}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeTransfers.filter(t => t.direction === 'receive').length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Download className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Ready to Receive</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Your device is discoverable. Files offered by peers will appear here.
          </p>
          <Link href="/peers">
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" /> View Discoverable Peers
            </Button>
          </Link>
        </motion.div>
      )}
    </div>
  )
}