"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ExportButtonProps {
  onExportCSV?: () => Promise<void>
  onExportExcel?: () => Promise<void>
  onExportPDF?: () => Promise<void>
  disabled?: boolean
  className?: string
}

export function ExportButton({
  onExportCSV,
  onExportExcel,
  onExportPDF,
  disabled = false,
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (type: "csv" | "excel" | "pdf", handler?: () => Promise<void>) => {
    if (!handler) {
      toast.error("Chức năng xuất dữ liệu chưa được triển khai")
      return
    }

    setIsExporting(true)
    try {
      await handler()
      toast.success(`Đã xuất dữ liệu thành công (${type.toUpperCase()})`)
    } catch (err) {
      console.error("Export error:", err)
      toast.error("Không thể xuất dữ liệu")
    } finally {
      setIsExporting(false)
    }
  }

  const hasAnyExport = onExportCSV || onExportExcel || onExportPDF

  if (!hasAnyExport) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={className}
          disabled={disabled || isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang xuất...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Xuất dữ liệu
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        {onExportCSV && (
          <DropdownMenuItem
            onClick={() => handleExport("csv", onExportCSV)}
            className="rounded-lg"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Xuất CSV
          </DropdownMenuItem>
        )}
        {onExportExcel && (
          <DropdownMenuItem
            onClick={() => handleExport("excel", onExportExcel)}
            className="rounded-lg"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Xuất Excel
          </DropdownMenuItem>
        )}
        {onExportPDF && (
          <DropdownMenuItem
            onClick={() => handleExport("pdf", onExportPDF)}
            className="rounded-lg"
          >
            <FileText className="h-4 w-4 mr-2" />
            Xuất PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
