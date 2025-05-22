"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { File, Pause, Play, X, Clock, CheckCircle2, AlertTriangle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

type TransferStatus = "transferring" | "paused" | "completed" | "cancelled" | "error"

export default function TransferPage({ params }: { params: { id: string } }) {
  const [transferStatus, setTransferStatus] = useState<TransferStatus>("transferring")
  const [progress, setProgress] = useState(0)
  const [transferSpeed, setTransferSpeed] = useState(1.2) // MB/s
  const [timeRemaining, setTimeRemaining] = useState("00:02:30")
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Mock file data
  const fileData = {
    id: params.id,
    name: "Project_Presentation.pdf",
    size: 25000000, // 25MB
    type: "application/pdf",
    recipient: "Alex's Device",
  }

  // Simulate transfer progress
  useEffect(() => {
    if (transferStatus !== "transferring") return

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + 1
        if (newProgress >= 100) {
          clearInterval(interval)
          setTransferStatus("completed")
          toast({
            title: "Transfer completed",
            description: "The file has been successfully transferred.",
            variant: "default",
          })
          return 100
        }

        // Randomly simulate network issues
        if (newProgress === 45 && Math.random() > 0.7) {
          clearInterval(interval)
          setTransferStatus("error")
          setError("Connection lost. Please retry the transfer.")
          toast({
            title: "Transfer error",
            description: "Connection lost. Please retry the transfer.",
            variant: "destructive",
          })
          return newProgress
        }

        // Update time remaining
        const remainingBytes = ((100 - newProgress) / 100) * fileData.size
        const remainingSeconds = Math.ceil(remainingBytes / (transferSpeed * 1024 * 1024))
        const minutes = Math.floor(remainingSeconds / 60)
        const seconds = remainingSeconds % 60
        setTimeRemaining(`00:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`)

        // Simulate fluctuating transfer speed
        if (newProgress % 10 === 0) {
          setTransferSpeed(1 + Math.random() * 1.5)
        }

        return newProgress
      })
    }, 300) // Update every 300ms for demo

    return () => clearInterval(interval)
  }, [transferStatus, transferSpeed, toast])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handlePauseResume = () => {
    if (transferStatus === "transferring") {
      setTransferStatus("paused")
      toast({
        title: "Transfer paused",
        description: "The file transfer has been paused.",
        variant: "default",
      })
    } else if (transferStatus === "paused") {
      setTransferStatus("transferring")
      toast({
        title: "Transfer resumed",
        description: "The file transfer has been resumed.",
        variant: "default",
      })
    }
  }

  const handleCancel = () => {
    setTransferStatus("cancelled")
    toast({
      title: "Transfer cancelled",
      description: "The file transfer has been cancelled.",
      variant: "destructive",
    })
  }

  const handleRetry = () => {
    setIsRetrying(true)
    setError(null)

    // Simulate retry delay
    setTimeout(() => {
      setTransferStatus("transferring")
      setIsRetrying(false)
      toast({
        title: "Transfer resumed",
        description: "Attempting to resume the file transfer.",
        variant: "default",
      })
    }, 1500)
  }

  const handleReturn = () => {
    router.push("/share")
  }

  return (
    <div className="container max-w-xl py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Transferring File</h1>
        <p className="text-muted-foreground mt-2">
          {transferStatus === "transferring" && "File transfer in progress"}
          {transferStatus === "paused" && "File transfer is paused"}
          {transferStatus === "completed" && "File transfer completed"}
          {transferStatus === "cancelled" && "File transfer cancelled"}
          {transferStatus === "error" && "File transfer encountered an error"}
        </p>
      </motion.div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <File className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{fileData.name}</h3>
                <p className="text-sm text-muted-foreground">Recipient: {fileData.recipient}</p>
              </div>
              <div className="flex items-center justify-center size-10 rounded-full">
                <AnimatePresence mode="wait">
                  {transferStatus === "transferring" && (
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
                  {transferStatus === "completed" && (
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
                  {transferStatus === "paused" && (
                    <motion.div
                      key="paused"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Pause className="h-5 w-5 text-orange-500" />
                    </motion.div>
                  )}
                  {transferStatus === "cancelled" && (
                    <motion.div
                      key="cancelled"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <X className="h-5 w-5 text-red-500" />
                    </motion.div>
                  )}
                  {transferStatus === "error" && (
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
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Transfer Progress</h3>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mb-6">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                className={`h-full rounded-full ${
                  transferStatus === "error"
                    ? "bg-red-500"
                    : transferStatus === "paused"
                      ? "bg-orange-500"
                      : "bg-primary"
                }`}
                transition={{ type: "spring", damping: 15, stiffness: 50 }}
              />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2 grid grid-cols-subgrid border-t border-border py-3">
                <span className="text-sm text-muted-foreground">Total Size</span>
                <span className="text-sm font-medium text-right">{formatFileSize(fileData.size)}</span>
              </div>
              <div className="col-span-2 grid grid-cols-subgrid border-t border-border py-3">
                <span className="text-sm text-muted-foreground">Transferred</span>
                <span className="text-sm font-medium text-right">
                  {formatFileSize((fileData.size * progress) / 100)}
                </span>
              </div>
              <div className="col-span-2 grid grid-cols-subgrid border-t border-border py-3">
                <span className="text-sm text-muted-foreground">Remaining</span>
                <span className="text-sm font-medium text-right">
                  {formatFileSize((fileData.size * (100 - progress)) / 100)}
                </span>
              </div>
              <div className="col-span-2 grid grid-cols-subgrid border-t border-border py-3">
                <span className="text-sm text-muted-foreground">Transfer Speed</span>
                <span className="text-sm font-medium text-right">{transferSpeed.toFixed(1)} MB/s</span>
              </div>
              <div className="col-span-2 grid grid-cols-subgrid border-t border-border py-3">
                <span className="text-sm text-muted-foreground">Estimated Time</span>
                <span className="text-sm font-medium text-right">{timeRemaining}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex flex-wrap justify-center gap-4"
      >
        {transferStatus === "transferring" && (
          <>
            <Button variant="outline" onClick={handlePauseResume} className="flex-1 gap-2">
              <Pause className="h-4 w-4" /> Pause
            </Button>
            <Button variant="destructive" onClick={handleCancel} className="flex-1 gap-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
          </>
        )}

        {transferStatus === "paused" && (
          <>
            <Button variant="outline" onClick={handlePauseResume} className="flex-1 gap-2">
              <Play className="h-4 w-4" /> Resume
            </Button>
            <Button variant="destructive" onClick={handleCancel} className="flex-1 gap-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
          </>
        )}

        {transferStatus === "completed" && (
          <Button onClick={handleReturn} className="flex-1 gap-2">
            <CheckCircle2 className="h-4 w-4" /> Done
          </Button>
        )}

        {transferStatus === "cancelled" && (
          <Button variant="outline" onClick={handleReturn} className="flex-1 gap-2">
            Return to Home
          </Button>
        )}

        {transferStatus === "error" && (
          <>
            <Button variant="default" onClick={handleRetry} disabled={isRetrying} className="flex-1 gap-2">
              {isRetrying ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  >
                    <Clock className="h-4 w-4" />
                  </motion.div>
                  Retrying...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Retry
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReturn} className="flex-1 gap-2">
              Return to Home
            </Button>
          </>
        )}
      </motion.div>
    </div>
  )
}
