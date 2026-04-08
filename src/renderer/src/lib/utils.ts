import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function toFileUrl(filePath: string): string {
  if (!filePath) return ''
  // Use our backend media API to bypass file:// security restrictions
  return `http://localhost:7666/api/media?path=${encodeURIComponent(filePath)}`
}
