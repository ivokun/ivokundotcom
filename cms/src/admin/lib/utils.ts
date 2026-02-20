import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }).format(d)
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
  mime_type?: string
  size?: number
  alt?: string | null
  urls?: { original: string; thumbnail: string; small: string; large: string } | null
  status?: string
  created_at?: string
}

/**
 * Get the URL for a media item
 * Uses the `urls` field from the API (R2 public URLs).
 * Falls back to empty string if media is not ready.
 */
export function getMediaUrl(media: MediaItem | string | null | undefined): string {
  if (!media) return ''

  // If it's a string (legacy / URL), use as-is
  if (typeof media === 'string') {
    return media
  }

  // Use thumbnail from urls if available
  if (media.urls) {
    return media.urls.thumbnail || media.urls.small || media.urls.original || ''
  }

  return ''
}

/**
 * Get the full-size original URL for a media item
 */
export function getMediaOriginalUrl(media: MediaItem | null | undefined): string {
  if (!media?.urls) return ''
  return media.urls.original || ''
}
