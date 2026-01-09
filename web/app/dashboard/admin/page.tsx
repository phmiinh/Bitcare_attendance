"use client"

import { useState, useEffect, useMemo } from "react"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Building2,
  AlertTriangle,
  UserCheck,
  Clock,
  LogOut,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Download,
  Sparkles,
} from "lucide-react"
import type { AdminTodayOps, AdminTopIssues, AdminAttendanceRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { subDays, format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Helper function to calculate late/early minutes from attendance record (same logic as timesheet)
function minutesSinceMidnight(input: string | null | undefined): number | null {
  if (!input) return null

  // HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(input)) {
    const [hh, mm] = input.split(":")
    const h = Number(hh)
    const m = Number(mm)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }

  // ISO datetime
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

function calculateLateEarly(record: AdminAttendanceRow): { lateMinutes: number; earlyLeaveMinutes: number } {
  const MORNING_LATE_FROM = 8 * 60 + 31 // 08:31 (từ 8h31 trở đi mới đi muộn, 8h30 là đúng giờ)
  const MORNING_OFF_FROM = 9 * 60 + 30 // >09:30 => nghỉ buổi sáng
  const NOON_EARLY_LEAVE_BEFORE = 12 * 60 // <12:00 => về sớm sáng
  const AFTERNOON_LATE_FROM = 13 * 60 + 31 // >13:30 => đi muộn chiều (nếu nghỉ sáng, từ 13h31)
  const AFTERNOON_OFF_BEFORE = 15 * 60 + 30 // <15:30 => nghỉ buổi chiều
  const AFTERNOON_EARLY_LEAVE_BEFORE = 18 * 60 // <18:00 => về sớm chiều (giờ kết thúc làm việc chuẩn)

  const ciMin = minutesSinceMidnight(record.checkInAt)
  const coMin = minutesSinceMidnight(record.checkOutAt)

  let lateMinutes = 0
  let earlyLeaveMinutes = 0

  // Determine morning state
  let isAbsentMorning = false
  let isLateMorning = false

  if (!record.checkInAt || ciMin === null) {
    // no check-in => nghỉ
    isAbsentMorning = true
  } else {
    if (ciMin > MORNING_OFF_FROM) {
      // Check-in after 09:30 => nghỉ buổi sáng
      isAbsentMorning = true
    } else if (ciMin >= MORNING_LATE_FROM && ciMin <= MORNING_OFF_FROM) {
      // 08:31-09:30 => đi muộn sáng (8h30 là đúng giờ)
      isLateMorning = true
      lateMinutes = Math.max(lateMinutes, ciMin - (8 * 60 + 30)) // Tính từ 8h30
    }
  }

  // Determine afternoon state
  let isAbsentAfternoon = false
  let isEarlyLeaveMorning = false
  let isEarlyLeaveAfternoon = false

  if (coMin !== null) {
    // Nếu checkout trước 12h: nghỉ buổi chiều + về sớm sáng (tính từ 12h)
    if (coMin < NOON_EARLY_LEAVE_BEFORE) {
      isAbsentAfternoon = true
      isEarlyLeaveMorning = true
      earlyLeaveMinutes = Math.max(earlyLeaveMinutes, NOON_EARLY_LEAVE_BEFORE - coMin)
    }
    // Nếu checkout từ 12h đến trước 15:30: chỉ nghỉ buổi chiều (không tính về sớm)
    else if (coMin < AFTERNOON_OFF_BEFORE) {
      isAbsentAfternoon = true
    }
    // Nếu checkout từ 15:30 đến trước 18h: về sớm chiều (tính từ 18h)
    else if (coMin < AFTERNOON_EARLY_LEAVE_BEFORE) {
      isEarlyLeaveAfternoon = true
      earlyLeaveMinutes = Math.max(earlyLeaveMinutes, AFTERNOON_EARLY_LEAVE_BEFORE - coMin)
    }
  }

  // Late afternoon: Nếu nghỉ sáng và checkin sau 13h30 => đi muộn chiều
  if (isAbsentMorning && record.checkInAt && ciMin !== null && ciMin > AFTERNOON_LATE_FROM) {
    // Check if checkout is before 15:30 (nghỉ buổi chiều) or after (đi muộn chiều)
    if (coMin !== null && coMin < AFTERNOON_OFF_BEFORE) {
      isAbsentAfternoon = true
    } else {
      lateMinutes = Math.max(lateMinutes, ciMin - (13 * 60 + 30)) // Tính từ 13h30
    }
  }

  // Chỉ tính earlyLeaveMinutes nếu đã checkout hoàn tất (status = "CLOSED")
  const isClosed = record.status === "CLOSED"
  const finalEarlyLeaveMinutes = isClosed && record.checkOutAt && coMin !== null ? earlyLeaveMinutes : 0

  // Chỉ tính lateMinutes nếu có check-in
  const finalLateMinutes = record.checkInAt && ciMin !== null ? lateMinutes : 0

  return {
    lateMinutes: finalLateMinutes,
    earlyLeaveMinutes: finalEarlyLeaveMinutes,
  }
}

export default function AdminDashboardPage() {
  const { t, language } = useI18n()
  const [todayOps, setTodayOps] = useState<AdminTodayOps | null>(null)
  const [topIssues, setTopIssues] = useState<AdminTopIssues | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<AdminAttendanceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())

  // Calculate topLate and topEarly from attendance records for selected month
  const computedTopIssues = useMemo(() => {
    if (attendanceRecords.length === 0) return null

    // Filter records for selected month
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)
    const monthStartStr = format(monthStart, "yyyy-MM-dd")
    const monthEndStr = format(monthEnd, "yyyy-MM-dd")

    const monthRecords = attendanceRecords.filter((record) => {
      const recordDate = record.workDate
      return recordDate >= monthStartStr && recordDate <= monthEndStr
    })

    // Group by user
    const userMap = new Map<number, { name: string; departmentName: string | null; lateCount: number; earlyCount: number }>()

    for (const record of monthRecords) {
      // Skip leave days (dayUnit === 0 or status === "MISSING") - same logic as timesheet
      const isLeaveDay = record.dayUnit === 0 || record.status === "MISSING"
      if (isLeaveDay) continue

      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, {
          name: record.userName,
          departmentName: record.departmentName || null,
          lateCount: 0,
          earlyCount: 0,
        })
      }

      const user = userMap.get(record.userId)!
      const { lateMinutes, earlyLeaveMinutes } = calculateLateEarly(record)

      // Đi muộn: Tính khi có check-in và có lateMinutes > 0
      if (record.checkInAt && lateMinutes > 0) {
        user.lateCount++
      }
      
      // Về sớm: Chỉ tính khi đã checkout (status = "CLOSED") và có earlyLeaveMinutes > 0
      const isClosed = record.status === "CLOSED"
      const hasCheckout = record.checkOutAt != null && record.checkOutAt !== ""
      if (isClosed && hasCheckout && earlyLeaveMinutes > 0) {
        user.earlyCount++
      }
    }

    // Convert to arrays and sort
    const topLate = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        name: data.name,
        count: data.lateCount,
        departmentName: data.departmentName,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topEarly = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        name: data.name,
        count: data.earlyCount,
        departmentName: data.departmentName,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return { topLate, topEarly }
  }, [attendanceRecords, selectedMonth])

  useEffect(() => {
    async function loadAdminData() {
      setIsLoading(true)
      try {
        const [todayRes, topIssuesRes] = await Promise.all([
          adminApi.getTodayOps(),
          adminApi.getTopIssues(),
        ])

        if (todayRes.data) setTodayOps(todayRes.data)
        if (topIssuesRes.data) {
          setTopIssues(topIssuesRes.data)
        }
      } catch (err) {
        console.error("Failed to load admin data:", err)
        toast.error("Không thể tải dữ liệu admin")
      } finally {
        setIsLoading(false)
      }
    }
    loadAdminData()
  }, [])

  // Load attendance records when selected month changes
  useEffect(() => {
    async function loadAttendanceData() {
      try {
        const monthStart = startOfMonth(selectedMonth)
        const monthEnd = endOfMonth(selectedMonth)
        const from = format(monthStart, "yyyy-MM-dd")
        const to = format(monthEnd, "yyyy-MM-dd")

        const attendanceRes = await adminApi.getAttendance({ from, to })
        if (attendanceRes.data) {
          setAttendanceRecords(attendanceRes.data.rows)
        }
      } catch (err) {
        console.error("Failed to load attendance data:", err)
      }
    }
    loadAttendanceData()
  }, [selectedMonth])

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
          value: `${y}-${String(m + 1).padStart(2, "0")}`,
          label: d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" }),
        })
      }
    }
    return opts
  }, [language])

  const currentMonthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`

  const handleGenerateCalendar = async () => {
    toast.info("Tính năng đang được phát triển")
  }

  const handleGrantLeave = async () => {
    toast.info("Tính năng đang được phát triển")
  }

  const handleExportReport = async () => {
    toast.info("Tính năng đang được phát triển")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.admin.dashboard.title}</h1>
        <p className="text-muted-foreground">Giám sát và quản lý hệ thống chấm công</p>
      </div>

      {/* Block A - Today Ops */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t.admin.dashboard.todayOps}
              </CardTitle>
          <CardDescription>Thống kê hoạt động hôm nay (realtime)</CardDescription>
            </CardHeader>
            <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : todayOps ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/30 bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {t.admin.dashboard.usersActive}
                      </p>
                      <p className="text-2xl font-bold mt-1">{todayOps.usersActive}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/30 bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {t.admin.dashboard.checkedIn}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                        {todayOps.checkedIn}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <UserCheck className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/30 bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {t.admin.dashboard.notCheckedIn}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                        {todayOps.notCheckedIn}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/30 bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {t.admin.dashboard.openSessions}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                        {todayOps.openSessions}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
            </CardContent>
          </Card>

              <Card className="border-border/30 bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {t.admin.dashboard.missingCheckout}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-destructive">
                        {todayOps.missingCheckout}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
                      <LogOut className="h-5 w-5" />
                    </div>
      </div>
                </CardContent>
              </Card>

              <Card className="border-border/30 bg-background/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {t.admin.dashboard.anomalies}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">
                        {todayOps.anomalies}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">{t.common.noData}</p>
          )}
        </CardContent>
      </Card>

      {/* Block B - Top Issues */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t.admin.dashboard.topIssues}
              </CardTitle>
              <CardDescription>Top 5 vấn đề trong tháng</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
              >
                ‹
              </Button>
              <Select
                value={currentMonthKey}
                onValueChange={(v) => {
                  const [y, m] = v.split("-")
                  setSelectedMonth(new Date(Number(y), Number(m) - 1, 1))
                }}
              >
                <SelectTrigger className="rounded-xl w-[200px]" size="sm">
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
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setSelectedMonth(new Date())}
              >
                {t.dateTime.thisMonth}
              </Button>
            </div>
            </div>
          </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (computedTopIssues || topIssues) ? (
            <div className="grid gap-6 md:grid-cols-3">
              {/* Top Late */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-sm">{t.admin.dashboard.topLate}</h3>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const topLateData = computedTopIssues?.topLate || topIssues?.topLate || []
                    return topLateData.length > 0 ? (
                      topLateData.slice(0, 5).map((item, idx) => (
                  <div
                        key={item.userId}
                        className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-background/50"
                  >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                            {idx + 1}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.departmentName && (
                              <p className="text-xs text-muted-foreground">{item.departmentName}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/50">
                          {item.count}
                        </Badge>
                      </div>
                    ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu</p>
                    )
                  })()}
                </div>
              </div>

              {/* Top Early */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-sm">{t.admin.dashboard.topEarly}</h3>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const topEarlyData = computedTopIssues?.topEarly || topIssues?.topEarly || []
                    return topEarlyData.length > 0 ? (
                      topEarlyData.slice(0, 5).map((item, idx) => (
                      <div
                        key={item.userId}
                        className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-background/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                            {idx + 1}
                          </Badge>
                      <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.departmentName && (
                              <p className="text-xs text-muted-foreground">{item.departmentName}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/50">
                          {item.count}
                        </Badge>
                      </div>
                    ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu</p>
                    )
                  })()}
                </div>
              </div>

              {/* Top Missing */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="font-semibold text-sm">{t.admin.dashboard.topMissing}</h3>
                    </div>
                <div className="space-y-2">
                  {(topIssues?.topMissing || []).length > 0 ? (
                    (topIssues?.topMissing || []).slice(0, 5).map((item, idx) => (
                      <div
                        key={item.userId}
                        className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-background/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                            {idx + 1}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.departmentName && (
                              <p className="text-xs text-muted-foreground">{item.departmentName}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-destructive border-destructive/50">
                          {item.count}
                    </Badge>
                  </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Không có dữ liệu</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">{t.common.noData}</p>
          )}
          </CardContent>
        </Card>

      {/* Block C - Quick Actions */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t.admin.dashboard.quickActions}
          </CardTitle>
          <CardDescription>Thao tác nhanh cho quản trị viên</CardDescription>
          </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4 gap-2 hover:bg-accent/50"
              onClick={handleGenerateCalendar}
            >
              <Calendar className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold text-sm">{t.admin.dashboard.generateCalendar}</p>
                <p className="text-xs text-muted-foreground">Tạo lịch làm việc cho tháng tiếp theo</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4 gap-2 hover:bg-accent/50"
              onClick={handleGrantLeave}
            >
              <FileText className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold text-sm">{t.admin.dashboard.grantLeave}</p>
                <p className="text-xs text-muted-foreground">Phát phép tháng này cho tất cả nhân viên</p>
                  </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start p-4 gap-2 hover:bg-accent/50"
              onClick={handleExportReport}
            >
              <Download className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold text-sm">{t.admin.dashboard.exportReport}</p>
                <p className="text-xs text-muted-foreground">Xuất báo cáo tháng (PDF/CSV)</p>
                  </div>
            </Button>
                </div>
          </CardContent>
        </Card>
    </div>
  )
}
