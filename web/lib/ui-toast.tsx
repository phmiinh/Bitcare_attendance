"use client"

import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import type { ReactNode } from "react"

export type ToastVariant = "success" | "error" | "info"

export function useUiToast() {
  const { t } = useI18n()

  return (variant: ToastVariant, key: string, detail?: ReactNode) => {
    const message = (t.toast as Record<string, string>)[key] || key

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
