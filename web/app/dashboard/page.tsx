"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { attendanceApi, statsApi, authApi, leaveApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock, LogIn, LogOut, Calendar, Timer, ArrowRight, TrendingUp, History, Info, Cake, Sparkles } from "lucide-react"
import type { AttendanceToday, AttendanceRow, StatsMe, AuthUser } from "@/lib/types"
import { cn, formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [todayRecord, setTodayRecord] = useState<AttendanceToday | null>(null)
  const [stats, setStats] = useState<StatsMe | null>(null)
  const [recentRecords, setRecentRecords] = useState<AttendanceRow[]>([])
  const [userInfo, setUserInfo] = useState<AuthUser | null>(null)
  const [leaveSummary, setLeaveSummary] = useState<{
    workedUnits: number
    missingUnits: number
    expectedUnits: number
    isBirthday: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return
      setIsLoading(true)
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        
        const [todayRes, statsRes, recentRes, userRes, summaryRes] = await Promise.all([
          attendanceApi.getToday(),
          statsApi.getMyStats(),
          attendanceApi.getMyAttendance(),
          authApi.getMe(),
          leaveApi.getSummary({ year, month }),
        ])

        if (todayRes.data) {
          setTodayRecord(todayRes.data)
        }
        if (statsRes.data) {
          setStats(statsRes.data)
        }
        if (recentRes.data) {
          setRecentRecords(recentRes.data.slice(0, 5))
        }
        if (userRes.data) {
          setUserInfo(userRes.data)
        }
        if (summaryRes.data) {
          setLeaveSummary({
            workedUnits: summaryRes.data.workedUnits ?? 0,
            missingUnits: summaryRes.data.missingUnits ?? 0,
            expectedUnits: summaryRes.data.expectedUnits ?? 0,
            isBirthday: summaryRes.data.isBirthday ?? false,
          })
        } else {
          // Nếu không có summary, set default
          setLeaveSummary({
            workedUnits: 0,
            missingUnits: 0,
            expectedUnits: 0,
            isBirthday: false,
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [user])

  const handleAction = async (action: "checkIn" | "checkOut") => {
    if (!user) return
    setIsLoading(true)
    try {
      const res = await (action === "checkIn" ? attendanceApi.checkIn() : attendanceApi.checkOut())
      if (res.error) {
        // Handle specific error codes
        const msg = (res.error.message || "").toLowerCase()
        if (res.error.code === "conflict" || msg.includes("already")) {
          toast.error(t.dashboard.alreadyCheckedIn)
        } else if (msg.includes("outside working hours") || msg.includes("not allowed")) {
          toast.error(t.dashboard.checkInNotAllowed)
        } else {
          toast.error(res.error.message || "Có lỗi xảy ra")
        }
        // Reload today record to sync with BE
        const todayRes = await attendanceApi.getToday()
        if (todayRes.data) setTodayRecord(todayRes.data)
        return
      }
      if (res.data) {
        setTodayRecord(res.data)
        toast.success(action === "checkIn" ? t.dashboard.checkInSuccess : t.dashboard.checkOutSuccess)
        // Refresh stats and summary
        const now = new Date()
        const [statsRes, summaryRes] = await Promise.all([
          statsApi.getMyStats(),
          leaveApi.getSummary({ year: now.getFullYear(), month: now.getMonth() + 1 }),
        ])
        if (statsRes.data) setStats(statsRes.data)
        if (summaryRes.data) {
          setLeaveSummary({
            workedUnits: summaryRes.data.workedUnits ?? 0,
            missingUnits: summaryRes.data.missingUnits ?? 0,
            expectedUnits: summaryRes.data.expectedUnits ?? 0,
            isBirthday: summaryRes.data.isBirthday ?? false,
          })
        }
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra khi thực hiện thao tác")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !stats) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    )
  }

  const workedTodayMinutes = todayRecord?.workedMinutes ?? 0

  // Lấy từ leave_monthly_summary (realtime)
  const workedUnits = leaveSummary?.workedUnits ?? 0
  const expectedUnits = leaveSummary?.expectedUnits ?? 0
  const missingUnits = leaveSummary?.missingUnits ?? 0
  const monthAttendancePercent = expectedUnits > 0 ? Math.round((workedUnits / expectedUnits) * 100) : 0

  const avgWorkedMinutesPerDay = (() => {
    if (!stats) return null
    const denom = stats.workedDays
    if (!denom) return null
    return Math.round(stats.totalWorkedMinutes / denom)
  })()

  const avgDeltaMinutesVsPrevMonth = (() => {
    const c = stats?.prevMonthComparison
    if (!c) return null
    const curDenom = c.currentWorkedDays
    const prevDenom = c.prevWorkedDays
    if (!curDenom || !prevDenom) return null

    const curAvg = c.currentTotalWorkedMinutes / curDenom
    const prevAvg = c.prevTotalWorkedMinutes / prevDenom
    return Math.round(curAvg - prevAvg)
  })()

  const formatMinutes = (totalMinutes: number) => {
    const m = Math.max(0, Math.floor(totalMinutes))
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}h ${String(mm).padStart(2, "0")}m`
  }

  // Check if user has birthday leave (birthday month is current month)
  // Kiểm tra từ userInfo.birthday để đảm bảo hiển thị vĩnh viễn trong tháng sinh nhật
  const isBirthdayMonth = (() => {
    if (!userInfo?.birthday) return false
    const birthday = new Date(userInfo.birthday)
    const now = new Date()
    return birthday.getMonth() === now.getMonth() && birthday.getFullYear() <= now.getFullYear()
  })()

  const todayStatusKey = (() => {
    if (!todayRecord) return "notCheckedIn"
    // Chưa check-in
    if (!todayRecord.checkInAt) return "notCheckedIn"
    if (todayRecord.status === "OPEN") return "working"
    if (todayRecord.status === "CLOSED") return "checkedOut"
    // Thiếu check-out
    return "missingCheckout"
  })()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t.dashboard.welcome}, {user?.name}
        </h1>
        <p className="text-muted-foreground">{t.dashboard.todayAttendance}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Today Action Card */}
        <Card className="lg:col-span-5 border-primary/20 bg-primary/5 lg:h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              {t.dateTime.today}
            </CardTitle>
            <CardDescription>{new Date().toLocaleDateString()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 rounded-xl border border-border/50 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{t.dashboard.workedToday}</p>
                <p className="text-sm font-semibold tabular-nums">{formatMinutes(workedTodayMinutes)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">{t.dashboard.status}</p>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    todayStatusKey === "notCheckedIn" && "border-muted-foreground/40 text-muted-foreground",
                    todayStatusKey === "working" && "border-amber-500/40 text-amber-600 dark:text-amber-400",
                    todayStatusKey === "checkedOut" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
                    todayStatusKey === "missingCheckout" && "border-destructive/40 text-destructive",
                  )}>
                    {t.dashboard.statusValues[todayStatusKey as keyof typeof t.dashboard.statusValues] ?? "--"}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t.dashboard.checkInTime}
                </span>
                <p className="text-2xl font-bold tracking-tighter">{todayRecord?.checkInAt || "--:--"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t.dashboard.checkOutTime}
                </span>
                <p className="text-2xl font-bold tracking-tighter">{todayRecord?.checkOutAt || "--:--"}</p>
              </div>
            </div>

            {!todayRecord?.checkInAt ? (
              <Button className="w-full h-12 text-lg font-semibold" onClick={() => handleAction("checkIn")}>
                <LogIn className="mr-2 h-5 w-5" />
                {t.dashboard.checkIn}
              </Button>
            ) : !todayRecord?.checkOutAt ? (
              <Button
                variant="secondary"
                className="w-full h-12 text-lg font-semibold"
                onClick={() => handleAction("checkOut")}
              >
                <LogOut className="mr-2 h-5 w-5" />
                {t.dashboard.checkOut}
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full h-12 text-lg font-semibold"
                onClick={() => handleAction("checkOut")}
              >
                <LogOut className="mr-2 h-5 w-5" />
                {t.dashboard.checkOut}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="lg:col-span-7 grid gap-4 sm:grid-cols-2">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.monthAttendanceTitle}</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-3xl font-bold tabular-nums">
                    {leaveSummary ? `${Math.round(workedUnits * 10) / 10}/${Math.round(expectedUnits * 10) / 10}` : "--"}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.dashboard.vsLastMonth}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {leaveSummary ? `${monthAttendancePercent}%` : "--"}
                  </div>
                </div>
              </div>
              <Progress value={monthAttendancePercent} className="h-2" />
              <p className="text-[11px] text-muted-foreground">{t.dashboard.clickToViewBreakdown}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t.dashboard.avgHoursThisMonthTitle}</CardTitle>
              <Timer className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold tabular-nums">
                  {avgWorkedMinutesPerDay === null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          — <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>{t.dashboard.insufficientData}</TooltipContent>
                    </Tooltip>
                  ) : (
                    formatMinutes(avgWorkedMinutesPerDay)
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t.dashboard.vsLastMonth}</p>
                  <p className={cn(
                    "text-xs font-medium tabular-nums",
                    (avgDeltaMinutesVsPrevMonth ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400",
                    (avgDeltaMinutesVsPrevMonth ?? 0) < 0 && "text-destructive",
                    (avgDeltaMinutesVsPrevMonth ?? 0) === 0 && "text-muted-foreground",
                  )}>
                    {avgDeltaMinutesVsPrevMonth === null
                      ? t.dashboard.deltaPlaceholder
                      : `${avgDeltaMinutesVsPrevMonth >= 0 ? "+" : ""}${avgDeltaMinutesVsPrevMonth}m`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Balance Card */}
          <Card className="bg-card/50 backdrop-blur-sm sm:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Ngày phép
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.dashboard.remainingLeaveDays}</p>
                <p className="text-2xl font-bold tabular-nums">
                  {userInfo?.paidLeave != null 
                    ? (userInfo.paidLeave % 1 === 0 
                        ? userInfo.paidLeave.toFixed(0) 
                        : userInfo.paidLeave.toFixed(1))
                    : "0"}
                </p>
              </div>
              {isBirthdayMonth && userInfo && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Cake className="h-5 w-5 text-primary" />
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary">
                      {t.dashboard.birthdayMonthMessage} <span className="font-semibold">{userInfo.name}</span>, {t.dashboard.birthdayLeaveMessage}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent History */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              {t.dashboard.recentActivity}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.push("/dashboard/timesheet")}>
            {t.common.selectAll} <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRecords.map((record, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{formatDate(record.workDate)}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{record.checkInAt || "--:--"}</span>
                      <span>→</span>
                      <span>{record.checkOutAt || "--:--"}</span>
                    </div>
                  </div>
                </div>
                <Badge
                  variant={record.status === "CLOSED" ? "secondary" : "outline"}
                  className={cn(
                    "capitalize px-2 py-0.5",
                    record.status === "OPEN" && "border-amber-500/50 text-amber-500",
                    record.status === "MISSING" && "border-destructive/50 text-destructive",
                  )}
                >
                  {record.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
