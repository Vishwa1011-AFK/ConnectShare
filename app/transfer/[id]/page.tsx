"use client"

import { useWebRTC, UIFileTransfer } from '@/contexts/WebRTCContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Download, FileDown, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, FileText, FileImage, FileArchive, FileAudio, FileVideo, FileIcon } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { formatFileSize } from "@/lib/utils"
import Link from "next/link"
import { Progress } from '@/components/ui/progress';

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return <FileImage className="h-8 w-8" />
  if (type.startsWith("video/")) return <FileVideo className="h-8 w-8" />
  if (type.startsWith("audio/")) return <FileAudio className="h-8 w-8" />
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz")) return <FileArchive className="h-8 w-8" />
  if (type.includes("pdf") || type.includes("doc") || type.includes("txt")) return <FileText className="h-8 w-8" />
  return <FileIcon className="h-8 w-8" />
}

const getStatusIcon = (status: UIFileTransfer["status"]) => {
  switch (status) {
    case "pending": case "waiting_acceptance": return <Clock className="h-6 w-6 text-yellow-500" />;
    case "transferring": return <FileDown className="h-6 w-6 text-blue-500" />;
    case "completed": return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    case "rejected": return <XCircle className="h-6 w-6 text-red-500" />;
    case "error": return <AlertTriangle className="h-6 w-6 text-red-500" />;
    default: return <Clock className="h-6 w-6 text-gray-500" />;
  }
}

const getStatusColor = (status: UIFileTransfer["status"]) => {
  switch (status) {
    case "pending": case "waiting_acceptance": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "transferring": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "completed": return "bg-green-500/10 text-green-500 border-green-500/20";
    case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
    case "error": return "bg-red-500/10 text-red-500 border-red-500/20";
    default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

export default function TransferPage() {
  const params = useParams();
  const transferId = params.id as string;
  const { getTransferById } = useWebRTC();
  const [transfer, setTransfer] = useState<UIFileTransfer | undefined>(undefined);
  const router = useRouter();
  const { toast } = useToast()

  useEffect(() => {
    const currentTransfer = getTransferById(transferId);
    setTransfer(currentTransfer);
  }, [transferId, getTransferById]);

  if (!transfer) {
    return (
      <div className="container py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center min-h-[50vh]"
        >
          <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
            <FileDown className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Transfer Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested transfer could not be found.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {transfer.direction === 'send' ? 'Sending' : 'Receiving'} File
        </h1>
        <p className="text-muted-foreground mt-2">Transfer details and progress</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                {getFileIcon(transfer.type)}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold truncate">{transfer.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(transfer.size)} • {transfer.type.split('/')[1] || transfer.type}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Peer Information */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Avatar className="h-10 w-10">
                <AvatarImage src={`https://avatar.vercel.sh/${transfer.peerId}.png`} alt={transfer.peerName} />
                <AvatarFallback>{transfer.peerName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{transfer.peerName}</p>
                <p className="text-sm text-muted-foreground">
                  {transfer.direction === 'send' ? 'Recipient' : 'Sender'}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                {getStatusIcon(transfer.status)}
                <div>
                  <p className="font-medium capitalize">
                    {transfer.status.replace('_', ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {transfer.status === 'waiting_acceptance' && 'Waiting for peer to accept'}
                    {transfer.status === 'pending' && 'Preparing to transfer'}
                    {transfer.status === 'transferring' && 'Transfer in progress'}
                    {transfer.status === 'completed' && 'Transfer completed successfully'}
                    {transfer.status === 'rejected' && 'Transfer was rejected'}
                    {transfer.status === 'error' && 'Transfer failed due to an error'}
                  </p>
                </div>
              </div>
              <Badge className={getStatusColor(transfer.status)}>
                {transfer.status.replace('_', ' ')}
              </Badge>
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  {transfer.progress.toFixed(1)}%
                </span>
              </div>
              <div className="relative">
                <Progress 
                  value={transfer.progress} 
                  className="h-3 bg-secondary"
                />
                <AnimatePresence>
                  {transfer.status === "transferring" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      style={{
                        background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)`,
                        animation: 'shimmer 2s infinite',
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
              {transfer.status === "transferring" && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground text-center"
                >
                  {(transfer.progress * transfer.size / 100 / 1024 / 1024).toFixed(1)} MB of {(transfer.size / 1024 / 1024).toFixed(1)} MB transferred
                </motion.p>
              )}
            </div>

            {/* Actions */}
            {transfer.status === 'completed' && transfer.direction === 'receive' && transfer.blob && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-4"
              >
                <Button 
                  onClick={() => {
                    if (transfer.blob) {
                      const url = URL.createObjectURL(transfer.blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = transfer.name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast({ title: "Downloaded", description: `${transfer.name} has been saved.` });
                    }
                  }}
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download File
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}