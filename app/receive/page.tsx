"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { Download, FileDown, Clock, Users, CheckCircle2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type IncomingFile = {
  id: string
  name: string
  size: number
  type: string
  sender: {
    id: string
    name: string
    avatar: string
  }
  status: "pending" | "accepted" | "rejected" | "completed"
}

export default function ReceivePage() {
  const [incomingFiles, setIncomingFiles] = useState<IncomingFile[]>([
    {
      id: "file-1",
      name: "Project_Presentation.pdf",
      size: 2500000,
      type: "application/pdf",
      sender: {
        id: "peer-123",
        name: "Alex's Device",
        avatar: "/placeholder.svg?height=40&width=40",
      },
      status: "pending",
    },
    {
      id: "file-2",
      name: "Meeting_Notes.docx",
      size: 1200000,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sender: {
        id: "peer-456",
        name: "Sarah's Laptop",
        avatar: "/placeholder.svg?height=40&width=40",
      },
      status: "accepted",
    },
    {
      id: "file-3",
      name: "Team_Photo.jpg",
      size: 4500000,
      type: "image/jpeg",
      sender: {
        id: "peer-789",
        name: "Meeting Room",
        avatar: "/placeholder.svg?height=40&width=40",
      },
      status: "completed",
    },
  ])

  const { toast } = useToast()

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleAcceptFile = (fileId: string) => {
    setIncomingFiles((files) => files.map((file) => (file.id === fileId ? { ...file, status: "accepted" } : file)))

    toast({
      title: "File accepted",
      description: "The file transfer will begin shortly.",
      variant: "default",
    })

    // Simulate file completion after 3 seconds
    setTimeout(() => {
      setIncomingFiles((files) => files.map((file) => (file.id === fileId ? { ...file, status: "completed" } : file)))

      toast({
        title: "File received",
        description: "The file has been successfully received.",
        variant: "default",
      })
    }, 3000)
  }

  const handleRejectFile = (fileId: string) => {
    setIncomingFiles((files) => files.map((file) => (file.id === fileId ? { ...file, status: "rejected" } : file)))

    toast({
      title: "File rejected",
      description: "The file transfer has been rejected.",
      variant: "default",
    })

    // Remove the file after 2 seconds
    setTimeout(() => {
      setIncomingFiles((files) => files.filter((file) => file.id !== fileId))
    }, 2000)
  }

  const getStatusBadge = (status: IncomingFile["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        )
      case "accepted":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
            <Download className="h-3 w-3 mr-1" /> Receiving
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 hover:bg-red-500/20">
            Rejected
          </Badge>
        )
    }
  }

  return (
    <div className="container py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight">Receive Files</h1>
        <p className="text-muted-foreground mt-2">Accept and receive files from connected peers</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10 text-primary">
              <FileDown className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">Incoming Files</h2>
            <Badge variant="outline">{incomingFiles.length}</Badge>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" /> Connected Peers
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <AnimatePresence>
              {incomingFiles.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 text-center text-muted-foreground"
                >
                  No incoming files
                </motion.div>
              ) : (
                incomingFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-4 border-b last:border-b-0 border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                        <FileDown className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{file.name}</h3>
                          {getStatusBadge(file.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <span>From:</span>
                            <Avatar className="h-4 w-4 mr-1">
                              <AvatarImage src={file.sender.avatar || "/placeholder.svg"} alt={file.sender.name} />
                              <AvatarFallback>{file.sender.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span>{file.sender.name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {file.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => handleAcceptFile(file.id)}>
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectFile(file.id)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {file.status === "accepted" && (
                        <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 3 }}
                            className="h-full bg-primary"
                          />
                        </div>
                      )}
                      {file.status === "completed" && (
                        <Button size="sm" variant="outline" className="gap-1">
                          <Download className="h-4 w-4" /> Save
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex flex-col items-center justify-center p-8 text-center"
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Download className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Ready to Receive</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          Your device is discoverable and ready to receive files from connected peers
        </p>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" /> View Connected Peers
        </Button>
      </motion.div>
    </div>
  )
}
