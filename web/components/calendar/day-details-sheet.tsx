"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatTime } from "@/lib/utils"
import type { DayData, CalendarStatus } from "@/components/calendar/month-calendar"
import { useAuth } from "@/lib/auth-context"
import { notesApi } from "@/lib/api"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n"
import { Loader2, Pencil, Save, X, Edit2, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const statusBadge = (status: CalendarStatus) => {
  switch (status) {
    case "present":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"

    case "lateMorning":
    case "lateAfternoon":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"

    case "absentMorning":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20"
    case "absentAfternoon":
      return "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20"

    case "earlyLeaveMorning":
    case "earlyLeaveAfternoon":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"

    case "lateMorning_earlyLeaveAfternoon":
    case "lateMorning_absentAfternoon":
    case "absentMorning_lateAfternoon":
    case "absentMorning_earlyLeaveAfternoon":
      return "bg-violet-600/10 text-violet-700 dark:text-violet-400 border-violet-600/20"

    case "missing":
      return "bg-destructive/10 text-destructive border-destructive/20"
    case "absent":
    default:
      return "bg-muted text-muted-foreground border-transparent"
  }
}

function fmtLate(min?: number) {
  const m = min ?? 0
  if (m <= 0) return "--"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${String(mm).padStart(2, "0")}m`
}

export function DayDetailsSheet({
  open,
  onOpenChange,
  day,
  labels,
  mode = "user",
  onEdit,
  onRecalculate,
  userId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  day: DayData | null
  mode?: "user" | "admin"
  onEdit?: (data: { checkInAt?: string; checkOutAt?: string; reason: string }) => Promise<void>
  onRecalculate?: (userId: number, year: number, month: number) => void
  userId?: number // For admin mode to fetch user's note
  labels: {
    title: string
    status: string
    checkIn: string
    checkOut: string
    worked: string
    late: string
    earlyLeave: string
    close: string
    statusLabels: Record<CalendarStatus, string>
    dayCredit: string
    dayCreditLabels: Record<"FULL" | "HALF" | "NONE", string>

    // Notes
    noteTitle: string
    notePlaceholder: string
    noteSaved: string
    noteEdit: string
    noteSaveChanges: string
    noteCancel: string
    noteSaveSuccess: string
    noteSaveError: string
    noteLoading: string
  }
}) {
  const { user } = useAuth()
  const { t } = useI18n()

  const [noteContent, setNoteContent] = useState("")
  const [original, setOriginal] = useState("")
  const [isNoteEditing, setIsNoteEditing] = useState(false)
  const [isNoteLoading, setIsNoteLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editCheckIn, setEditCheckIn] = useState("")
  const [editCheckOut, setEditCheckOut] = useState("")
  const [editReason, setEditReason] = useState("")

  const workDate = useMemo(() => {
    if (!day) return null
    const y = day.date.getFullYear()
    const m = String(day.date.getMonth() + 1).padStart(2, "0")
    const d = String(day.date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [day])

  const hasExisting = useMemo(() => original.trim().length > 0, [original])
  const hasChanges = useMemo(() => noteContent !== original, [noteContent, original])

  useEffect(() => {
    if (!open) {
      setIsEditing(false)
      setIsSaving(false)
      setIsNoteLoading(false)
      if (mode === "admin") {
        setIsEditing(false)
        setEditCheckIn("")
        setEditCheckOut("")
        setEditReason("")
      }
      return
    }
    
    if (mode === "admin" && day) {
      // Convert to HH:mm format for time input (24h format)
      const formatTimeForInput = (timeStr: string | null | undefined): string => {
        if (!timeStr) return ""
        
        // If already in HH:MM:SS format (e.g., "18:36:00"), extract HH:MM
        if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
          return timeStr.slice(0, 5) // Returns "18:36"
        }
        
        // If in HH:MM format, validate and return
        if (/^\d{2}:\d{2}$/.test(timeStr)) {
          const [h, m] = timeStr.split(':').map(Number)
          // Validate hours (0-23) and minutes (0-59)
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            return timeStr
          }
        }
        
        // Try to parse as Date/ISO string and format to 24h (HH:mm)
        // Handle both ISO datetime strings and time-only strings
        let d: Date | null = null
        if (timeStr.includes('T') || timeStr.includes(' ')) {
          // ISO datetime or date-time string
          d = new Date(timeStr)
        } else {
          // Try parsing as time string with today's date
          const today = new Date()
          const [hours, minutes, seconds] = timeStr.split(':').map(Number)
          if (!isNaN(hours) && !isNaN(minutes)) {
            d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds || 0)
          }
        }
        
        if (d && !isNaN(d.getTime())) {
          const hours = String(d.getHours()).padStart(2, '0')
          const minutes = String(d.getMinutes()).padStart(2, '0')
          return `${hours}:${minutes}`
        }
        
        return ""
      }
      setEditCheckIn(formatTimeForInput(day.checkInAt))
      setEditCheckOut(formatTimeForInput(day.checkOutAt))
      setEditReason("")
    }

    async function loadNote() {
      if (!workDate) return
      const targetUserId = mode === "admin" && userId ? userId : user?.id
      if (!targetUserId) return
      
      setIsNoteLoading(true)
      try {
        const res = await notesApi.getMyNotes(workDate, targetUserId)
        const c = res.data?.content ?? ""
        setNoteContent(c)
        setOriginal(c)
        // Only allow editing in user mode
        setIsNoteEditing(mode === "user" && c.trim().length === 0)
      } finally {
        setIsNoteLoading(false)
      }
    }

    if (mode === "user" || (mode === "admin" && userId)) {
      loadNote()
    }
  }, [open, user, workDate, mode, userId])

  if (!day) return null

  const worked = (() => {
    const m = day.workedMinutes ?? 0
    if (m <= 0) return "--"
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h ${String(mm).padStart(2, "0")}m`
  })()

  const enterEdit = () => {
    setOriginal(noteContent)
    setIsNoteEditing(true)
  }

  const cancelEdit = () => {
    setNoteContent(original)
    setIsNoteEditing(false)
  }

  const saveNote = async () => {
    if (!user || !workDate) return
    if (!noteContent.trim()) return

    setIsSaving(true)
    try {
      const res = await notesApi.updateMyNote(workDate, noteContent, user.id)
      if (res.data) {
        const c = res.data.content ?? ""
        setNoteContent(c)
        setOriginal(c)
        setIsNoteEditing(false)
        toast.success(labels.noteSaveSuccess)
      } else if (res.error) {
        toast.error(res.error.message || labels.noteSaveError)
      }
    } catch (e) {
      console.error(e)
      toast.error(labels.noteSaveError)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md [&>button]:hidden">
        <SheetHeader className="relative">
          <SheetTitle className="text-base font-semibold pr-24">
            {labels.title}: {format(day.date, "dd/MM/yyyy")}
          </SheetTitle>
          {mode === "admin" && !isEditing && (
            <Button 
              variant="outline" 
              size="sm" 
              className="absolute top-4 right-4 rounded-xl gap-2" 
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4" />
              {t.users.detail.editAttendance}
            </Button>
          )}
          {mode === "admin" && isEditing && (
            <Button 
              size="sm" 
              className="absolute top-4 right-4 rounded-xl gap-2" 
              onClick={async () => {
                if (!editReason.trim()) {
                  toast.error(t.users.detail.reasonRequiredError)
                  return
                }
                
                // Validate time format before sending
                const validateTimeFormat = (timeStr: string): boolean => {
                  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)
                }
                
                if (editCheckIn && !validateTimeFormat(editCheckIn)) {
                  toast.error(t.users.detail.invalidCheckInFormat)
                  return
                }
                
                if (editCheckOut && !validateTimeFormat(editCheckOut)) {
                  toast.error(t.users.detail.invalidCheckOutFormat)
                  return
                }
                
                // Format time to RFC3339 (ISO datetime) for backend
                const formatToRFC3339 = (timeStr: string): string => {
                  if (!timeStr || !day) return ""
                  const [hours, minutes] = timeStr.split(':')
                  const date = new Date(day.date)
                  date.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0)
                  // Format as RFC3339 (ISO 8601)
                  return date.toISOString()
                }
                
                if (onEdit) {
                  try {
                    await onEdit({
                      checkInAt: editCheckIn ? formatToRFC3339(editCheckIn) : undefined,
                      checkOutAt: editCheckOut ? formatToRFC3339(editCheckOut) : undefined,
                      reason: editReason,
                    })
                    // Only close editing mode on success (onEdit completed without error)
                    // If onEdit returns early due to error, this won't be reached
                    setIsEditing(false)
                  } catch (err) {
                    // Error is handled in parent, keep form open
                    console.error("Error in onEdit:", err)
                    // Don't close form on error
                  }
                }
              }}
            >
              <Save className="h-4 w-4" />
              {t.users.detail.saveChanges}
            </Button>
          )}
        </SheetHeader>

        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{labels.status}</span>
            <Badge variant="outline" className={cn("capitalize", statusBadge(day.status))}>
              {labels.statusLabels[day.status]}
            </Badge>
          </div>

          {mode === "admin" && isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkIn">{t.timesheet.checkIn}</Label>
                  <Input
                    id="checkIn"
                    type="text"
                    value={editCheckIn}
                    onChange={(e) => {
                      let value = e.target.value
                      // Remove any non-digit characters except colon
                      value = value.replace(/[^\d:]/g, '')
                      // Limit length to prevent too long input
                      if (value.length <= 5) {
                        // Auto-add colon after 2 digits if not present
                        if (value.length === 2 && !value.includes(':')) {
                          value = value + ':'
                        }
                        // Allow free typing, only format on blur
                        setEditCheckIn(value)
                      }
                    }}
                    onBlur={(e) => {
                      // Validate and format on blur
                      let value = e.target.value.trim()
                      if (!value) {
                        setEditCheckIn("")
                        return
                      }
                      
                      // If format is HH:MM or HH:M, validate and format
                      if (value.includes(':')) {
                        const [h, m = ''] = value.split(':')
                        const hours = parseInt(h) || 0
                        const minutes = parseInt(m) || 0
                        
                        // Clamp hours to 0-23, minutes to 0-59
                        const validHours = Math.min(23, Math.max(0, hours))
                        const validMinutes = Math.min(59, Math.max(0, minutes))
                        
                        setEditCheckIn(`${String(validHours).padStart(2, '0')}:${String(validMinutes).padStart(2, '0')}`)
                      } else if (/^\d+$/.test(value)) {
                        // If just numbers, try to interpret as HH or HHMM
                        const num = parseInt(value) || 0
                        if (value.length <= 2) {
                          // Interpret as hours
                          const hours = Math.min(23, Math.max(0, num))
                          setEditCheckIn(`${String(hours).padStart(2, '0')}:00`)
                        } else if (value.length === 4) {
                          // Interpret as HHMM
                          const hours = Math.min(23, Math.max(0, parseInt(value.slice(0, 2)) || 0))
                          const minutes = Math.min(59, Math.max(0, parseInt(value.slice(2, 4)) || 0))
                          setEditCheckIn(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
                        }
                      }
                    }}
                    placeholder="HH:mm (24h)"
                    className="rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">{t.timesheet.checkOut}</Label>
                  <Input
                    id="checkOut"
                    type="text"
                    value={editCheckOut}
                    onChange={(e) => {
                      let value = e.target.value
                      // Remove any non-digit characters except colon
                      value = value.replace(/[^\d:]/g, '')
                      // Limit length to prevent too long input
                      if (value.length <= 5) {
                        // Auto-add colon after 2 digits if not present
                        if (value.length === 2 && !value.includes(':')) {
                          value = value + ':'
                        }
                        // Allow free typing, only format on blur
                        setEditCheckOut(value)
                      }
                    }}
                    onBlur={(e) => {
                      // Validate and format on blur
                      let value = e.target.value.trim()
                      if (!value) {
                        setEditCheckOut("")
                        return
                      }
                      
                      // If format is HH:MM or HH:M, validate and format
                      if (value.includes(':')) {
                        const [h, m = ''] = value.split(':')
                        const hours = parseInt(h) || 0
                        const minutes = parseInt(m) || 0
                        
                        // Clamp hours to 0-23, minutes to 0-59
                        const validHours = Math.min(23, Math.max(0, hours))
                        const validMinutes = Math.min(59, Math.max(0, minutes))
                        
                        setEditCheckOut(`${String(validHours).padStart(2, '0')}:${String(validMinutes).padStart(2, '0')}`)
                      } else if (/^\d+$/.test(value)) {
                        // If just numbers, try to interpret as HH or HHMM
                        const num = parseInt(value) || 0
                        if (value.length <= 2) {
                          // Interpret as hours
                          const hours = Math.min(23, Math.max(0, num))
                          setEditCheckOut(`${String(hours).padStart(2, '0')}:00`)
                        } else if (value.length === 4) {
                          // Interpret as HHMM
                          const hours = Math.min(23, Math.max(0, parseInt(value.slice(0, 2)) || 0))
                          const minutes = Math.min(59, Math.max(0, parseInt(value.slice(2, 4)) || 0))
                          setEditCheckOut(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
                        }
                      }
                    }}
                    placeholder="HH:mm (24h)"
                    className="rounded-xl font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">{t.users.detail.reasonRequired}</Label>
                <Textarea
                  id="reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder={t.users.detail.reasonPlaceholder}
                  className="min-h-[80px] rounded-xl"
                />
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl gap-2"
                onClick={() => {
                  // Format time back to HH:mm 24h format when canceling
                  const formatTimeForInput = (timeStr: string | null | undefined): string => {
                    if (!timeStr) return ""
                    if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
                      return timeStr.slice(0, 5)
                    }
                    if (/^\d{2}:\d{2}$/.test(timeStr)) {
                      return timeStr
                    }
                    const d = new Date(timeStr)
                    if (!isNaN(d.getTime())) {
                      const hours = String(d.getHours()).padStart(2, '0')
                      const minutes = String(d.getMinutes()).padStart(2, '0')
                      return `${hours}:${minutes}`
                    }
                    return ""
                  }
                  setIsEditing(false)
                  setEditCheckIn(formatTimeForInput(day.checkInAt))
                  setEditCheckOut(formatTimeForInput(day.checkOutAt))
                  setEditReason("")
                }}
              >
                <X className="h-4 w-4" />
                {t.users.detail.cancel}
              </Button>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{labels.checkIn}</p>
              <p className="font-medium tabular-nums">{formatTime(day.checkInAt ?? null)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{labels.checkOut}</p>
              <p className="font-medium tabular-nums">{formatTime(day.checkOutAt ?? null)}</p>
            </div>
          </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{labels.worked}</p>
              <p className="font-medium tabular-nums">{worked}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{labels.late}</p>
              <p className="font-medium tabular-nums">{day.lateMinutes ? fmtLate(day.lateMinutes) : "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{labels.earlyLeave}</p>
              <p className="font-medium tabular-nums">{day.earlyLeaveMinutes ? fmtLate(day.earlyLeaveMinutes) : "--"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{labels.dayCredit}</span>
            <Badge variant="secondary" className="capitalize">
              {labels.dayCreditLabels[day.dayCredit ?? "NONE"]}
            </Badge>
          </div>

          {(mode === "user" || (mode === "admin" && userId)) && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{labels.noteTitle}</p>
                {mode === "user" && !isNoteLoading && hasExisting && !isNoteEditing ? (
                <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={enterEdit}>
                  <Pencil className="h-4 w-4" />
                  {labels.noteEdit}
                </Button>
              ) : null}
            </div>

            {isNoteLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {labels.noteLoading}
              </div>
            ) : (
              <>
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder={labels.notePlaceholder}
                  disabled={mode === "admin" || !isNoteEditing}
                  className="min-h-[140px] resize-none rounded-xl disabled:opacity-70"
                />

                {mode === "user" && (
                  <div className="flex justify-end gap-2">
                    {isNoteEditing && hasExisting ? (
                      <Button variant="outline" className="rounded-xl gap-2" onClick={cancelEdit} disabled={isSaving}>
                        <X className="h-4 w-4" />
                        {labels.noteCancel}
                      </Button>
                    ) : null}

                    {isNoteEditing ? (
                      <Button
                        className="rounded-xl gap-2"
                        onClick={saveNote}
                        disabled={isSaving || !noteContent.trim() || (hasExisting && !hasChanges)}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {hasExisting ? labels.noteSaveChanges : labels.noteSaved}
                      </Button>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {mode === "admin" && isEditing && onRecalculate && workDate && (
            <div className="pt-2 border-t border-border/50">
              <Button
                variant="outline"
                className="w-full rounded-xl gap-2"
                onClick={() => {
                  const date = new Date(workDate)
                  // Get userId from day data if available, or use current user
                  const userId = (day as any).userId || user?.id
                  if (userId) {
                    onRecalculate(userId, date.getFullYear(), date.getMonth() + 1)
                  }
                }}
              >
                  <RefreshCw className="h-4 w-4" />
                  {t.users.detail.recalculateSummary}
                </Button>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  )
}
