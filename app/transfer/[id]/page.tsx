"use client"

import { useWebRTC, UIFileTransfer } from '@/contexts/WebRTCContext';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Download, FileDown, Clock, Users, CheckCircle2, XCircle, AlertTriangle, ServerCrash } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatFileSize } from "@/lib/utils"
import { FileCard } from "@/components/file-card"
import Link from "next/link"
import { Progress } from '@/components/ui/progress';

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

    if (currentTransfer && (currentTransfer.status === 'completed' || currentTransfer.status === 'error' || currentTransfer.status === 'rejected')) {
    }
  }, [transferId, getTransferById, router]);

  if (!transfer) {
    return <div className="container py-8">Loading transfer details or transfer not found...</div>;
  }

  return (
    <div className="container max-w-xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">
          {transfer.direction === 'send' ? 'Sending' : 'Receiving'} File: {transfer.name}
        </h1>
        <p className="text-muted-foreground mt-2">Status: {transfer.status}</p>
      </motion.div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
              <FileDown className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{transfer.name}</h3>
              <p className="text-sm text-muted-foreground">Recipient: {transfer.peerName}</p>
            </div>
            <div className="flex items-center justify-center size-10 rounded-full">
              <AnimatePresence mode="wait">
                {transfer.status === "transferring" && (
                  <motion.div
                    key="transferring"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    exit={{ scale: 0 }}
                    transition={{
                      duration: 0.3,
                      rotate: {
                        duration: 2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      },
                    }}
                  >
                    <Clock className="h-5 w-5 text-primary" />
                  </motion.div>
                )}
                {transfer.status === "completed" && (
                  <motion.div
                    key="completed"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </motion.div>
                )}
                {transfer.status === "error" && (
                  <motion.div
                    key="error"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <Progress value={transfer.progress} className="mt-4 h-4" />
          <p className="mt-2 text-sm">{transfer.progress.toFixed(0)}%</p>
          <Button onClick={() => router.back()} className="mt-6">Go Back</Button>
        </CardContent>
      </Card>
    </div>
  );
}