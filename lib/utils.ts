import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Get file type icon name based on mime type
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.includes("pdf")) return "pdf"
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) return "archive"
  if (mimeType.includes("text") || mimeType.includes("doc")) return "text"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "spreadsheet"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation"
  return "file"
}

// Get file extension from file name
export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toUpperCase() || ""
}

// Generate a unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

// Handle API errors
export async function handleApiError(error: unknown): Promise<string> {
  if (error instanceof Error) {
    return error.message
  }
  return "An unknown error occurred"
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout !== null) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(later, wait)
  }
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
