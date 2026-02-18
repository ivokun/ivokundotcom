import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }).format(new Date(date))
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Safely parse JSON string with fallback
 * Returns parsed JSON or null if parsing fails
 */
export function safeParseJSON<T = any>(content: string | null | undefined): T | null {
  if (!content || typeof content !== 'string') return null
  try {
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

/**
 * Try to parse content as JSON, fallback to treating it as raw HTML/text
 * Returns a TipTap-compatible document structure
 */
export function parseEditorContent(content: string | null | undefined): object | string {
  if (!content) return ''
  if (typeof content !== 'string') return content
  
  // Try JSON first
  const parsed = safeParseJSON(content)
  if (parsed) return parsed
  
  // If not valid JSON and not empty, treat as HTML/text
  // Return as-is for TipTap to handle
  return content
}

export interface MediaItem {
  id: string
  filename: string
  mimeType?: string
  size?: number
  alt?: string | null
  createdAt?: string
}

/**
 * Get the URL for a media item
 * Accepts either a MediaItem object or a filename string
 * Returns consistent /uploads/ path
 */
export function getMediaUrl(media: MediaItem | string | null | undefined): string {
  if (!media) return ''
  
  // If it's a string, use it directly (assume it's a filename)
  if (typeof media === 'string') {
    return `/uploads/${media}`
  }
  
  // If it's a MediaItem, use the filename
  if (media.filename) {
    return `/uploads/${media.filename}`
  }
  
  return ''
}
