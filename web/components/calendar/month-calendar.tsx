"use client"

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatTime } from "@/lib/utils"

export type CalendarStatus =
  | "present"
  | "working"
  // Morning
  | "lateMorning"
  | "absentMorning"
  | "earlyLeaveMorning"
  // Afternoon
  | "lateAfternoon"
  | "absentAfternoon"
  | "earlyLeaveAfternoon"
  // Combinations
  | "lateMorning_earlyLeaveAfternoon"
  | "lateMorning_absentAfternoon"
  | "absentMorning_lateAfternoon"
  | "absentMorning_earlyLeaveAfternoon"
  | "absentAfternoon_earlyLeaveMorning"
  | "lateAfternoon_earlyLeaveAfternoon"
  // Generic
  | "missing"
  | "absent"

export type DayData = {
  date: Date
  status: CalendarStatus
  checkInAt?: string | null
  checkOutAt?: string | null
  workedMinutes?: number
  lateMinutes?: number
  earlyLeaveMinutes?: number
  dayCredit?: "FULL" | "HALF" | "NONE"
}

const statusClass = (status: CalendarStatus) => {
  switch (status) {
    case "present":
      return "bg-emerald-500/90 hover:bg-emerald-500 text-white"
    case "working":
      return "bg-blue-500/90 hover:bg-blue-500 text-white"
    case "lateMorning":
      return "bg-amber-500/90 hover:bg-amber-500 text-white"
    case "lateAfternoon":
      return "bg-amber-600/90 hover:bg-amber-600 text-white"
    case "absentMorning":
      return "bg-orange-500/90 hover:bg-orange-500 text-white"
    case "absentAfternoon":
      return "bg-fuchsia-500/90 hover:bg-fuchsia-500 text-white"
    case "earlyLeaveMorning":
      return "bg-sky-500/90 hover:bg-sky-500 text-white"
    case "earlyLeaveAfternoon":
      return "bg-sky-600/90 hover:bg-sky-600 text-white"
    case "lateMorning_earlyLeaveAfternoon":
      return "bg-violet-600/90 hover:bg-violet-600 text-white"
    case "lateMorning_absentAfternoon":
      return "bg-violet-700/90 hover:bg-violet-700 text-white"
    case "absentMorning_lateAfternoon":
      return "bg-violet-500/90 hover:bg-violet-500 text-white"
    case "absentMorning_earlyLeaveAfternoon":
      return "bg-violet-800/90 hover:bg-violet-800 text-white"
    case "absentAfternoon_earlyLeaveMorning":
      return "bg-violet-900/90 hover:bg-violet-900 text-white"
    case "missing":
      return "bg-destructive/90 hover:bg-destructive text-white"
    case "absent":
    default:
      return "bg-muted hover:bg-muted/80 text-muted-foreground"
  }
}

function fmtWorked(m?: number) {
  if (!m || m <= 0) return ""
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${String(mm).padStart(2, "0")}m`
}

function fmtLate(min?: number) {
  const m = min ?? 0
  if (m <= 0) return "--"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h ${String(mm).padStart(2, "0")}m`
}

export function MonthCalendar({
  currentMonth,
  days,
  onMonthChange,
  onDayClick,
  labels,
  className,
}: {
  currentMonth: Date
  days: DayData[]
  onMonthChange: (d: Date) => void
  onDayClick: (d: DayData) => void
  labels: {
    monthTitle: (d: Date) => string
    weekdays: string[]
    tooltip: {
      checkIn: string
      checkOut: string
      worked: string
      late: string
      earlyLeave: string
    }
    status: Record<CalendarStatus, string>
    noData: string
  }
  className?: string
}) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const getDayData = (date: Date): DayData => {
    return (
      days.find((d) => isSameDay(d.date, date)) || {
        date,
        status: "absent",
      }
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">{labels.monthTitle(currentMonth)}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
        {labels.weekdays.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {gridDays.map((d) => {
          const day = getDayData(d)
          const inMonth = isSameMonth(d, currentMonth)
          const today = isToday(d)
          const worked = fmtWorked(day.workedMinutes)

          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative group rounded-xl p-2 h-16 flex flex-col items-start justify-between transition-colors",
                statusClass(day.status),
                !inMonth && "opacity-40",
                today && "ring-2 ring-primary/40",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className={cn("text-sm font-semibold", today && "font-extrabold")}>{format(d, "d")}</span>
                {day.status !== "absent" ? (
                  <span className="text-[10px] font-medium opacity-90">{labels.status[day.status]}</span>
                ) : null}
              </div>
              <div className="text-[11px] font-medium opacity-90 tabular-nums">{worked}</div>

              <div
                className={cn(
                  "pointer-events-none absolute z-50 w-56 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "-top-2 left-1/2 -translate-x-1/2 -translate-y-full",
                )}
              >
                <div className="p-3 space-y-1">
                  <div className="font-semibold text-sm">{format(d, "dd/MM/yyyy")}</div>
                  {day.status === "absent" ? (
                    <div className="text-xs text-muted-foreground">{labels.noData}</div>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{labels.tooltip.checkIn}</span>
                        <span className="tabular-nums">{formatTime(day.checkInAt ?? null)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{labels.tooltip.checkOut}</span>
                        <span className="tabular-nums">{formatTime(day.checkOutAt ?? null)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{labels.tooltip.worked}</span>
                        <span className="tabular-nums">{worked || "--"}</span>
                      </div>
                      {day.lateMinutes ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{labels.tooltip.late}</span>
                          <span className="tabular-nums">{fmtLate(day.lateMinutes)}</span>
                        </div>
                      ) : null}
                      {day.earlyLeaveMinutes ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{labels.tooltip.earlyLeave}</span>
                          <span className="tabular-nums">{fmtLate(day.earlyLeaveMinutes)}</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
