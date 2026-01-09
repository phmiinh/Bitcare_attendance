"use client"

import { useState, useEffect, useMemo } from "react"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, Sparkles, Save, X, ChevronLeft, ChevronRight } from "lucide-react"
import type { WorkCalendarDay } from "@/lib/types"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function toLocalYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function monthKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function parseMonthKey(v: string) {
  const [y, m] = v.split("-")
  const year = Number(y)
  const month = Number(m)
  if (!year || !month) return new Date()
  return new Date(year, month - 1, 1)
}

export default function AdminWorkCalendarPage() {
  const { t, language } = useI18n()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [calendarDays, setCalendarDays] = useState<WorkCalendarDay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<WorkCalendarDay | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  useEffect(() => {
    loadCalendar()
  }, [currentMonth])

  async function loadCalendar() {
    setIsLoading(true)
    try {
      const from = toLocalYMD(startOfMonth(currentMonth))
      const to = toLocalYMD(endOfMonth(currentMonth))
      const res = await adminApi.getWorkCalendar({ from, to })
      if (res.data) {
        setCalendarDays(res.data)
      } else {
        setCalendarDays([])
      }
    } catch (err) {
      console.error("Failed to load calendar:", err)
      toast.error(t.admin.workCalendar.loadError)
    } finally {
      setIsLoading(false)
    }
  }

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  const getDayData = (date: Date): WorkCalendarDay | null => {
    const dateStr = toLocalYMD(date)
    return calendarDays.find((d) => d.date === dateStr) || null
  }

  const handleDayClick = (date: Date) => {
    const dayData = getDayData(date)
    if (dayData) {
      setSelectedDay(dayData)
      setEditDialogOpen(true)
    } else {
      // Create new day
      setSelectedDay({
        date: toLocalYMD(date),
        isWorkingDay: true,
        workUnit: 1.0,
        note: null,
      })
      setEditDialogOpen(true)
    }
  }

  const handleSaveDay = async (day: WorkCalendarDay) => {
    try {
      const res = await adminApi.updateWorkCalendarDay(day)
      if (res.error) {
        toast.error(res.error.message || t.admin.workCalendar.saveError)
      } else {
        toast.success(t.admin.workCalendar.saveSuccess)
        setEditDialogOpen(false)
        loadCalendar()
      }
    } catch (err) {
      toast.error(t.admin.workCalendar.unknownError)
    }
  }

  const handleBulkSetWeekends = async () => {
    const weekends = gridDays.filter((d) => {
      const weekday = d.getDay()
      return isSameMonth(d, currentMonth) && (weekday === 0 || weekday === 6) // Sunday or Saturday
    })

    const updates = weekends.map((d) => ({
      date: toLocalYMD(d),
      isWorkingDay: false,
      workUnit: 0.0,
      note: null,
    }))

    try {
      const res = await adminApi.bulkUpdateWorkCalendar({ days: updates })
      if (res.error) {
        toast.error(res.error.message || t.admin.workCalendar.saveError)
      } else {
        toast.success(t.admin.workCalendar.bulkUpdateSuccess.replace("{count}", updates.length.toString()))
        loadCalendar()
      }
    } catch (err) {
      toast.error(t.admin.workCalendar.unknownError)
    }
  }

  const handleGenerate = async () => {
    const year = currentMonth.getFullYear()
    try {
      const res = await adminApi.generateWorkCalendar(year)
      if (res.error) {
        toast.error(res.error.message || t.admin.workCalendar.generateError)
      } else {
        toast.success(t.admin.workCalendar.generateSuccess.replace("{year}", year.toString()))
        loadCalendar()
      }
    } catch (err) {
      toast.error(t.admin.workCalendar.unknownError)
    }
  }

  const monthOptions = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const startYear = currentYear - 1
    const endYear = currentYear + 1
    const opts: { value: string; label: string }[] = []
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1)
        opts.push({
          value: monthKey(d),
          label: d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" }),
        })
      }
    }
    return opts
  }, [language])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.nav.adminWorkCalendar}</h1>
          <p className="text-muted-foreground">{t.admin.workCalendar.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleBulkSetWeekends}>
            <Calendar className="h-4 w-4" />
            {t.admin.workCalendar.setAllWeekends}
          </Button>
          <Button variant="outline" className="rounded-xl gap-2" onClick={handleGenerate}>
            <Sparkles className="h-4 w-4" />
            {t.admin.workCalendar.generateYear} {currentMonth.getFullYear()}
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-end gap-2">
            <Select value={monthKey(currentMonth)} onValueChange={(v) => setCurrentMonth(parseMonthKey(v))}>
              <SelectTrigger className="rounded-xl" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-72">
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCurrentMonth(new Date())}>
              {t.dateTime.thisMonth}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-semibold">
                  {currentMonth.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" })}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground mb-2">
                {t.admin.workCalendar.weekdays.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {gridDays.map((d) => {
                  const dayData = getDayData(d)
                  const inMonth = isSameMonth(d, currentMonth)
                  const today = isToday(d)

                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => handleDayClick(d)}
                      className={cn(
                        "relative group rounded-xl p-2 h-16 flex flex-col items-start justify-between transition-colors",
                        dayData?.isWorkingDay
                          ? dayData.workUnit >= 1.0
                            ? "bg-emerald-500/90 hover:bg-emerald-500 text-white"
                            : "bg-amber-500/90 hover:bg-amber-500 text-white"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground",
                        !inMonth && "opacity-40",
                        today && "ring-2 ring-primary/40",
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={cn("text-sm font-semibold", today && "font-extrabold")}>
                          {format(d, "d")}
                        </span>
                        {dayData && (
                          <span className="text-[10px] font-medium opacity-90">
                            {dayData.workUnit === 1.0 ? "1.0" : dayData.workUnit === 0.5 ? "0.5" : "0"}
                          </span>
                        )}
                      </div>
                      {dayData?.note && (
                        <div className="text-[10px] font-medium opacity-90 truncate w-full">
                          {dayData.note}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t.admin.workCalendar.editDay}</DialogTitle>
            <DialogDescription>
              {selectedDay && `${t.admin.workCalendar.dayLabel} ${format(new Date(selectedDay.date), "dd/MM/yyyy")}`}
            </DialogDescription>
          </DialogHeader>
          {selectedDay && (
            <EditDayForm
              day={selectedDay}
              onSave={(updated) => {
                handleSaveDay(updated)
              }}
              onCancel={() => setEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditDayForm({
  day,
  onSave,
  onCancel,
}: {
  day: WorkCalendarDay
  onSave: (day: WorkCalendarDay) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [isWorkingDay, setIsWorkingDay] = useState(day.isWorkingDay)
  const [workUnit, setWorkUnit] = useState(day.workUnit)
  const [note, setNote] = useState(day.note || "")

  useEffect(() => {
    setIsWorkingDay(day.isWorkingDay)
    setWorkUnit(day.workUnit)
    setNote(day.note || "")
  }, [day])

  const handleSave = () => {
    onSave({
      ...day,
      isWorkingDay,
      workUnit,
      note: note.trim() || null,
    })
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isWorkingDay"
          checked={isWorkingDay}
          onCheckedChange={(checked) => {
            setIsWorkingDay(checked === true)
            if (!checked) {
              setWorkUnit(0)
            } else if (workUnit === 0) {
              setWorkUnit(1.0)
            }
          }}
        />
        <Label htmlFor="isWorkingDay" className="font-medium">
          {t.admin.workCalendar.isWorkingDay}
        </Label>
      </div>

      {isWorkingDay && (
        <div className="space-y-2">
          <Label htmlFor="workUnit">{t.admin.workCalendar.workUnit}</Label>
          <Select
            value={workUnit.toString()}
            onValueChange={(v) => setWorkUnit(parseFloat(v))}
          >
            <SelectTrigger id="workUnit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.0">{t.admin.workCalendar.workUnitFull}</SelectItem>
              <SelectItem value="0.5">{t.admin.workCalendar.workUnitHalf}</SelectItem>
              <SelectItem value="0.0">{t.admin.workCalendar.workUnitNone}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="note">{t.admin.workCalendar.note}</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.admin.workCalendar.notePlaceholder}
          className="min-h-[80px] rounded-xl"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="rounded-xl">
          <X className="h-4 w-4 mr-2" />
          {t.common.cancel}
        </Button>
        <Button onClick={handleSave} className="rounded-xl">
          <Save className="h-4 w-4 mr-2" />
          {t.common.save}
        </Button>
      </DialogFooter>
    </div>
  )
}
