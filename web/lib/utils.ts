import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// === Date / Time formatting helpers ===
// Return date in DD/MM/YYYY format (e.g. 05/01/2026)
export function formatDate(date: string | number | Date): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Return time in HH:mm format (e.g. 08:30)
export function formatTime(date: string | number | Date | null | undefined): string {
  if (!date) return '--:--'
  
  // If it's already in HH:MM:SS format, just extract HH:MM
  if (typeof date === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(date)) {
    return date.slice(0, 5) // Return HH:MM
  }
  
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  if (isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
