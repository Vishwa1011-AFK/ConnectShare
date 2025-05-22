"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, File, X, Check, AlertCircle, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
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
import { cn } from "@/lib/utils"

type FileWithPreview = {
  file: File
  id: string
  preview?: string
}

export default function SharePage() {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Handle drag events
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    // Only set dragging to false if we're leaving the drop area (not a child element)
    if (dropAreaRef.current && !dropAreaRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])

  // Handle file selection
  const handleFiles = (fileList: FileList) => {
    const newFiles = Array.from(fileList).map((file) => ({
      file,
      id: Math.random().toString(36).substring(2, 9),
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }))

    setFiles((prev) => [...prev, ...newFiles])

    toast({
      title: "Files added",
      description: `${newFiles.length} file(s) added successfully.`,
      variant: "default",
    })
  }

  // Clean up previews when component unmounts
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview)
        }
      })
    }
  }, [files])

  const removeFile = (id: string) => {
    setFiles((files) => {
      const fileToRemove = files.find((f) => f.id === id)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return files.filter((f) => f.id !== id)
    })
  }

  const clearAllFiles = () => {
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
    })
    setFiles([])

    toast({
      title: "Files cleared",
      description: "All files have been removed.",
      variant: "default",
    })
  }

  const handleBrowseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      // Reset the input value so the same file can be selected again
      e.target.value = ""
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const startSharing = () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to share.",
        variant: "destructive",
      })
      return
    }

    // Simulate upload progress
    setIsUploading(true)
    setUploadProgress(0)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)

          toast({
            title: "Files ready to share",
            description: "Your files are now available for peers to download.",
            variant: "default",
          })

          return 100
        }
        return prev + 5
      })
    }, 200)
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Selected Files</h2>
          {files.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear All</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all files?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently remove all selected files.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllFiles}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 text-muted-foreground/70" />
                <p>No files selected</p>
                <p className="text-sm">Files you select will appear here</p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <div className="hidden md:block">
                  {" "}
                  {/* Table view for larger screens */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {files.map((file) => (
                          <motion.tr
                            key={file.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="group"
                          >
                            <TableCell>
                              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                                <File className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{file.file.name}</TableCell>
                            <TableCell>{file.file.type || "Unknown"}</TableCell>
                            <TableCell className="text-right">{formatFileSize(file.file.size)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFile(file.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4" />
                                <span className="sr-only">Remove</span>
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden p-4 space-y-4">
                  {" "}
                  {/* Card view for mobile */}
                  <AnimatePresence>
                    {files.map((file) => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex items-center justify-between">
                          <FileCard name={file.file.name} size={file.file.size} type={file.file.type || "Unknown"} />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            className="ml-2 shrink-0"
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="flex flex-col sm:flex-row justify-end gap-4 mt-6"
      >
        {isUploading && (
          <div className="w-full mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Preparing files...</span>
              <span className="text-sm font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="sm:order-1"
        >
          Add More Files
        </Button>

        <Button onClick={startSharing} disabled={files.length === 0 || isUploading} className="gap-2 sm:order-2">
          {isUploading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              >
                <Upload className="h-4 w-4" />
              </motion.div>
              Preparing...
            </>
          ) : (
            <>
              Start Sharing <Check className="h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}
