"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { File, FileText, FileImage, FileArchive, FileAudio, FileVideo } from "lucide-react"
import { motion } from "framer-motion"

type FileCardProps = {
  name: string
  size: number
  type: string
  status?: "pending" | "transferring" | "paused" | "completed" | "error" | "rejected" | "waiting_acceptance"
  progress?: number
}

export function FileCard({ name, size, type, status, progress }: FileCardProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = () => {
    if (type.startsWith("image/")) {
      return <FileImage className="h-6 w-6" />
    } else if (type.startsWith("video/")) {
      return <FileVideo className="h-6 w-6" />
    } else if (type.startsWith("audio/")) {
      return <FileAudio className="h-6 w-6" />
    } else if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz")) {
      return <FileArchive className="h-6 w-6" />
    } else if (type.includes("pdf") || type.includes("doc") || type.includes("txt")) {
      return <FileText className="h-6 w-6" />
    } else {
      return <File className="h-6 w-6" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
      case "transferring":
        return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
      case "paused":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
      case "completed":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      case "error":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      case "waiting_acceptance":
        return "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20"
      case "rejected":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      default:
        return "bg-secondary text-secondary-foreground"
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
            {getFileIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{name}</h3>
              {status && (
                <Badge variant="outline" className={getStatusColor()}>
                  {status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(size)} • {type.split("/")[1] || type}
            </p>
            {progress !== undefined && progress > 0 && progress < 100 && (
              <div className="w-full h-1 bg-secondary rounded-full mt-2 overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-primary"
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
