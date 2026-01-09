"use client"

import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import type { ReactNode } from "react"

export type ToastVariant = "success" | "error" | "info"

// Helper function to get nested value from object by dot notation path
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split(".")
  let current: any = obj
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[key]
  }
  return typeof current === "string" ? current : undefined
}

export function useUiToast() {
  const { t } = useI18n()

  return (variant: ToastVariant, key: string, detail?: ReactNode) => {
    // Try to get from nested path first (e.g., "departments.createSuccess")
    let message = getNestedValue(t, key)
    
    // Fallback to toast object if not found
    if (!message) {
      message = (t.toast as Record<string, string>)?.[key]
    }
    
    // Final fallback to the key itself
    if (!message) {
      message = key
    }

    const options =
      detail !== undefined
        ? {
            description: detail,
          }
        : undefined

    if (variant === "success") {
      toast.success(message, options)
    } else if (variant === "error") {
      toast.error(message, options)
    } else {
      toast(message, options)
    }
  }
}
