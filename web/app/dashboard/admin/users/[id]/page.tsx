"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import { adminApi, attendanceApi, leaveApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, User, Calendar, FileText, History, Edit2, Save, X, Trash2 } from "lucide-react"
import type { User as UserType, AttendanceRecord, LeaveMonthlySummary } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { MonthCalendar, type DayData, type CalendarStatus } from "@/components/calendar/month-calendar"
import { DayDetailsSheet } from "@/components/calendar/day-details-sheet"

// Helper functions (reuse from timesheet)
function toLocalYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function eachDay(start: Date, end: Date) {
  const days: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function minutesSinceMidnight(input: string | null | undefined) {
  if (!input) return null
  if (/^\d{2}:\d{2}:\d{2}$/.test(input)) {
    const [hh, mm] = input.split(":")
    const h = Number(hh)
    const m = Number(mm)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
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

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language } = useI18n()
  const userId = params.id ? parseInt(params.id as string) : null
  const defaultTab = searchParams.get("tab") || "profile"

  const [user, setUser] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<UserType>>({})
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!userId) return
    loadUser()
  }, [userId])

  async function loadUser() {
    if (!userId) return
    setIsLoading(true)
    try {
      const res = await adminApi.getUsers({ limit: 100 })
      if (res.data) {
        const foundUser = res.data.items?.find((u) => u.id === userId)
        if (foundUser) {
          setUser(foundUser)
          setEditData(foundUser)
        } else {
          toast.error(t.users.detail.userNotFound)
          router.push("/dashboard/admin/users")
        }
      }
    } catch (err) {
      console.error("Failed to load user:", err)
      toast.error(t.users.detail.loadError)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    try {
      const res = await adminApi.updateUser(user.id, editData)
      if (res.error) {
        toast.error(res.error.message || t.users.detail.updateError)
      } else {
        toast.success(t.users.detail.updateSuccess)
        setIsEditing(false)
        if (res.data) {
          setUser(res.data)
          setEditData(res.data)
        }
      }
    } catch (err) {
      toast.error(t.users.detail.unknownError)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    setIsDeleting(true)
    try {
      const res = await adminApi.deleteUser(user.id)
      if (res.error) {
        toast.error(res.error.message || t.users.detail.deleteError)
      } else {
        toast.success(t.users.detail.deleteSuccess)
        router.push("/dashboard/admin/users")
      }
    } catch (err) {
      toast.error(t.users.detail.deleteError)
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">{t.users.detail.userNotFound}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.push("/dashboard/admin/users")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="profile" className="rounded-lg gap-2">
            <User className="h-4 w-4" />
            {t.users.detail.tabInfo}
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg gap-2">
            <Calendar className="h-4 w-4" />
            {t.users.detail.tabAttendance}
          </TabsTrigger>
          <TabsTrigger value="leave" className="rounded-lg gap-2">
            <FileText className="h-4 w-4" />
            {t.users.detail.tabLeave}
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg gap-2" disabled>
            <History className="h-4 w-4" />
            {t.users.detail.tabAudit}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t.users.detail.personalInfo}</CardTitle>
              {!isEditing ? (
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl gap-2" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4" />
                    {t.users.detail.edit}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.users.detail.deleteUser}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl gap-2" onClick={() => {
                    setIsEditing(false)
                    setEditData(user)
                  }}>
                    <X className="h-4 w-4" />
                    {t.common.cancel}
                  </Button>
                  <Button className="rounded-xl gap-2" onClick={handleSave}>
                    <Save className="h-4 w-4" />
                    {t.common.save}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.users.detail.name}</Label>
                  <Input
                    id="name"
                    value={isEditing ? editData.name || "" : user.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    disabled={!isEditing}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t.users.detail.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={isEditing ? editData.email || "" : user.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    disabled={!isEditing}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t.users.userRole}</Label>
                  <Select
                    value={isEditing ? editData.role || "user" : user.role}
                    onValueChange={(v) => setEditData({ ...editData, role: v as any })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t.users.roleUser}</SelectItem>
                      <SelectItem value="admin">{t.users.roleAdmin}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t.users.userStatus}</Label>
                  <Select
                    value={isEditing ? editData.status || "active" : user.status}
                    onValueChange={(v) => setEditData({ ...editData, status: v as any })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t.users.statusActive}</SelectItem>
                      <SelectItem value="disabled">{t.users.statusDisabled}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paidLeave">{t.users.detail.paidLeave}</Label>
                  <Input
                    id="paidLeave"
                    type="number"
                    step="0.5"
                    value={isEditing ? editData.paidLeave?.toString() || "0" : user.paidLeave?.toString() || "0"}
                    onChange={(e) => setEditData({ ...editData, paidLeave: parseFloat(e.target.value) || 0 })}
                    disabled={!isEditing}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <UserAttendanceTab userId={userId!} />
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <UserLeaveTab userId={userId!} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center py-8">{t.users.detail.featureDevelopment}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users.detail.deleteUser}</AlertDialogTitle>
            <AlertDialogDescription>{t.users.detail.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
              {t.common.cancel}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl"
            >
              {isDeleting ? t.common.loading : t.common.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Attendance Tab Component
function UserAttendanceTab({ userId }: { userId: number }) {
  const { t, language } = useI18n()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<{
    workedUnits: number
    missingUnits: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const from = toLocalYMD(startOfMonth(currentMonth))
        const to = toLocalYMD(endOfMonth(currentMonth))
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1

        const [attendanceRes, leaveRes] = await Promise.all([
          adminApi.getAttendance({ from, to, userId }),
          adminApi.getLeaveSummaries({ userId, year, month }),
        ])

        if (attendanceRes.data) {
          // Convert AdminAttendanceRow to AttendanceRecord format
          const convertedRecords = attendanceRes.data.rows.map((row) => ({
            id: row.id, // Keep session ID for editing
            workDate: row.workDate,
            checkInAt: row.checkInAt,
            checkOutAt: row.checkOutAt,
            workedMinutes: row.workedMinutes,
            dayUnit: row.dayUnit,
            notePreview: null,
            status: row.status,
            isLeave: false,
            isUnpaidLeave: false,
          }))
          setRecords(convertedRecords as any)
        } else {
          setRecords([])
        }

        if (leaveRes.data && leaveRes.data.length > 0) {
          const summaryData = leaveRes.data[0]
          setSummary({
            workedUnits: summaryData.workedUnits ?? 0,
            missingUnits: summaryData.missingUnits ?? 0,
          })
        } else {
          setSummary({ workedUnits: 0, missingUnits: 0 })
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [currentMonth, userId])

  const days: DayData[] = useMemo(() => {
    const from = startOfMonth(currentMonth)
    const to = endOfMonth(currentMonth)
    const byDate = new Map<string, AttendanceRecord>()
    for (const r of records) byDate.set(r.workDate, r)
    const allDays = eachDay(from, to)

    return allDays.map((d) => {
      const key = toLocalYMD(d)
      const r = byDate.get(key)

      // Check if this is a leave day
      const isLeave = r?.isLeave === true
      const isUnpaidLeave = r?.isUnpaidLeave === true

      // Skip weekends (Saturday=6, Sunday=0)
      const weekday = d.getDay()
      const isWeekend = weekday === 6 || weekday === 0

      if (!r) {
        // No attendance record
        if (isLeave) {
          // Marked as leave - show as leave (red)
          return { date: d, status: "missing" as CalendarStatus }
        }
        if (isWeekend) {
          // Weekend - show as muted/disabled
          return { date: d, status: "absent" as CalendarStatus }
        }
        return { date: d, status: "absent" as CalendarStatus }
      }

      // If marked as leave, prioritize showing leave status (always show as red/missing)
      if (isLeave) {
        return {
          date: d,
          status: "missing" as CalendarStatus, // Always show leave days as red
          checkInAt: r.checkInAt,
          checkOutAt: r.checkOutAt,
          workedMinutes: r.workedMinutes,
          dayCredit: "NONE" as const,
        }
      }

      let status: CalendarStatus = "absent"
      if (r.status === "MISSING") status = "missing"
      else if (r.status === "OPEN") {
        // Đã check-in nhưng chưa check-out
        if (r.checkInAt && !r.checkOutAt) {
          // Sẽ được xác định sau khi tính toán late/early leave
          status = "working"
        } else {
          status = "missing"
        }
      } else if (r.status === "CLOSED") status = "present"

      // Thresholds (minutes since midnight) - Updated logic
      const MORNING_LATE_FROM = 8 * 60 + 31 // 08:31 (từ 8h31 trở đi mới đi muộn, 8h30 là đúng giờ)
      const MORNING_OFF_FROM = 9 * 60 + 30 // >09:30 => nghỉ buổi sáng

      const NOON_EARLY_LEAVE_BEFORE = 12 * 60 // <12:00 => về sớm sáng

      const AFTERNOON_LATE_FROM = 13 * 60 + 31 // >13:30 => đi muộn chiều (nếu nghỉ sáng, từ 13h31)
      const AFTERNOON_OFF_BEFORE = 15 * 60 + 30 // <15:30 => nghỉ buổi chiều
      const AFTERNOON_EARLY_LEAVE_BEFORE = 18 * 60 // <18:00 => về sớm chiều (giờ kết thúc làm việc chuẩn)

      const ciMin = minutesSinceMidnight(r.checkInAt)
      const coMin = minutesSinceMidnight(r.checkOutAt)

      // We track both kinds of minutes (can show both)
      let lateMinutes = 0
      let earlyLeaveMinutes = 0

      // Determine morning state
      let isAbsentMorning = false
      let isLateMorning = false

      if (!r.checkInAt || ciMin === null) {
        // no check-in => nghỉ (treat as absent for whole day)
        status = "absent"
        isAbsentMorning = true
        isAbsentAfternoon = true
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
      let isLateAfternoon = false
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
      if (isAbsentMorning && r.checkInAt && ciMin !== null && ciMin > AFTERNOON_LATE_FROM) {
        // Check if checkout is before 15:30 (nghỉ buổi chiều) or after (đi muộn chiều)
        if (coMin !== null && coMin < AFTERNOON_OFF_BEFORE) {
          isAbsentAfternoon = true
        } else {
          isLateAfternoon = true
          lateMinutes = Math.max(lateMinutes, ciMin - (13 * 60 + 30)) // Tính từ 13h30
        }
      }

      // Build final status (we still keep "missing" from backend if needed)
      // Nếu status là "working" (đã check-in chưa check-out), vẫn cần xét đi muộn/về sớm
      if (status !== "missing") {
        if (status === "absent") {
          // keep absent
        } else if (status === "working") {
          // Đang làm nhưng có đi muộn/về sớm thì vẫn hiển thị status tương ứng
          // Ưu tiên các trường hợp kết hợp để hiển thị đủ cả đi muộn và về sớm
          if (isAbsentMorning && isLateAfternoon) status = "absentMorning_lateAfternoon"
          else if (isAbsentMorning && isEarlyLeaveAfternoon) status = "absentMorning_earlyLeaveAfternoon"
          else if (isAbsentAfternoon && isLateMorning) status = "lateMorning_absentAfternoon"
          else if (isAbsentAfternoon && isEarlyLeaveMorning) status = "absentAfternoon_earlyLeaveMorning"
          else if (isLateMorning && isEarlyLeaveAfternoon) status = "lateMorning_earlyLeaveAfternoon"
          else if (isLateAfternoon && isEarlyLeaveAfternoon) status = "lateAfternoon_earlyLeaveAfternoon"
          else if (isLateMorning && isEarlyLeaveMorning) status = "lateMorning" // Đi muộn sáng + về sớm sáng (hiếm)
          else if (isLateMorning) status = "lateMorning"
          else if (isAbsentMorning) status = "absentMorning"
          else if (isAbsentAfternoon) status = "absentAfternoon"
          else if (isLateAfternoon) status = "lateAfternoon"
          else if (isEarlyLeaveMorning) status = "earlyLeaveMorning"
          else if (isEarlyLeaveAfternoon) status = "earlyLeaveAfternoon"
          // Nếu không có đi muộn/về sớm gì thì giữ nguyên "working"
        } else {
          // if backend said present/closed but no checkin handled above; else derive from flags
          // Ưu tiên các trường hợp kết hợp để hiển thị đủ cả đi muộn và về sớm
          if (isAbsentMorning && isAbsentAfternoon) status = "absent"
          else if (isAbsentMorning && isLateAfternoon) status = "absentMorning_lateAfternoon"
          else if (isAbsentMorning && isEarlyLeaveAfternoon) status = "absentMorning_earlyLeaveAfternoon"
          else if (isAbsentAfternoon && isLateMorning) status = "lateMorning_absentAfternoon"
          else if (isAbsentAfternoon && isEarlyLeaveMorning) status = "absentAfternoon_earlyLeaveMorning"
          else if (isLateMorning && isEarlyLeaveAfternoon) status = "lateMorning_earlyLeaveAfternoon"
          else if (isLateAfternoon && isEarlyLeaveAfternoon) status = "lateAfternoon_earlyLeaveAfternoon"
          else if (isLateMorning && isEarlyLeaveMorning) status = "lateMorning" // Đi muộn sáng + về sớm sáng (hiếm)
          else if (isLateMorning) status = "lateMorning"
          else if (isAbsentMorning) status = "absentMorning"
          else if (isAbsentAfternoon) status = "absentAfternoon"
          else if (isLateAfternoon) status = "lateAfternoon"
          else if (isEarlyLeaveMorning) status = "earlyLeaveMorning"
          else if (isEarlyLeaveAfternoon) status = "earlyLeaveAfternoon"
          else status = "present"
        }
      }

      // If dayUnit is 0 (not counted), show as "missing" (red) - same as leave days
      // This ensures consistency: days that don't count as work are shown as "Nghỉ" (red)
      // This check must be AFTER all status logic to ensure it takes priority
      if (r.dayUnit === 0) {
        status = "missing"
      }

      // Chỉ set earlyLeaveMinutes nếu đã checkout hoàn tất (status = "CLOSED" và có checkOutAt)
      // Nếu chưa checkout hoặc status không phải CLOSED thì không tính về sớm
      const isClosed = r.status === "CLOSED"
      const finalEarlyLeaveMinutes = (isClosed && r.checkOutAt && coMin !== null) ? (earlyLeaveMinutes || undefined) : undefined

      return {
        date: d,
        status,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        workedMinutes: r.workedMinutes,
        lateMinutes: lateMinutes || undefined,
        earlyLeaveMinutes: finalEarlyLeaveMinutes,
        dayCredit: r.dayUnit >= 1 ? "FULL" : r.dayUnit >= 0.5 ? "HALF" : "NONE",
        userId,
        sessionId: (r as any).id, // Store session ID for editing
      } as DayData & { userId: number; sessionId?: number }
    })
  }, [records, currentMonth, userId])

  // Calculate statistics from days data and summary
  const stats = useMemo(() => {
    let lateCount = 0
    let earlyLeaveCount = 0

    days.forEach((day) => {
      const isLeaveDay = day.status === "missing" || day.dayCredit === "NONE"
      // Ngày nghỉ buổi chiều cũng không nên đếm vào về sớm (đã tính vào "Nghỉ" rồi)
      const isAbsentAfternoon = day.status === "absentAfternoon" || day.status === "lateMorning_absentAfternoon"
      
      // Đi muộn: Tính cả khi chưa checkout (status = OPEN hoặc CLOSED)
      // Vì đi muộn được xác định ngay khi check-in
      if (!isLeaveDay && day.checkInAt && day.lateMinutes && day.lateMinutes > 0) {
        lateCount++
      }
      
      // Về sớm: Chỉ tính khi đã checkout (status = CLOSED)
      // Vì về sớm chỉ biết được khi đã checkout
      // KHÔNG tính ngày nghỉ buổi chiều (đã tính vào "Nghỉ" rồi)
      const hasCheckout = day.checkOutAt != null && day.checkOutAt !== "" && day.checkOutAt !== "--:--"
      if (!isLeaveDay && !isAbsentAfternoon && hasCheckout && day.earlyLeaveMinutes && day.earlyLeaveMinutes > 0) {
        earlyLeaveCount++
      }
    })

    return {
      workedUnits: summary ? Math.round(summary.workedUnits * 10) / 10 : 0, // Round to 1 decimal
      missingUnits: summary ? Math.round(summary.missingUnits * 10) / 10 : 0, // Round to 1 decimal
      lateCount,
      earlyLeaveCount,
    }
  }, [days, summary])

  const calendarLabels = useMemo(
    () => ({
      monthTitle: (d: Date) =>
        d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" }),
      weekdays:
        language === "vi" ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      tooltip: {
        checkIn: t.timesheet.checkIn,
        checkOut: t.timesheet.checkOut,
        worked: t.timesheet.workedTime,
        late: t.timesheet.lateMinutes,
        earlyLeave: t.timesheet.earlyLeaveMinutes,
      },
      status: {
        present: t.timesheet.present,
        working: t.timesheet.working,
        lateMorning: t.timesheet.lateMorning,
        absentMorning: t.timesheet.absentMorning,
        earlyLeaveMorning: t.timesheet.earlyLeaveMorning,
        lateAfternoon: t.timesheet.lateAfternoon,
        absentAfternoon: t.timesheet.absentAfternoon,
        earlyLeaveAfternoon: t.timesheet.earlyLeaveAfternoon,
        lateMorning_earlyLeaveAfternoon: t.timesheet.lateMorningEarlyLeaveAfternoon,
        lateMorning_absentAfternoon: t.timesheet.lateMorningAbsentAfternoon,
        absentMorning_lateAfternoon: t.timesheet.absentMorningLateAfternoon,
        absentMorning_earlyLeaveAfternoon: t.timesheet.absentMorningEarlyLeaveAfternoon,
        absentAfternoon_earlyLeaveMorning: t.timesheet.absentAfternoonEarlyLeaveMorning,
        lateAfternoon_earlyLeaveAfternoon: t.timesheet.lateAfternoonEarlyLeaveAfternoon,
        missing: t.timesheet.missing,
        absent: t.timesheet.absent,
      } as Record<CalendarStatus, string>,
      noData: t.timesheet.noRecords,
    }),
    [t, language],
  )

  const sheetLabels = useMemo(
    () => ({
      title: t.timesheet.dayDetails,
      status: t.timesheet.status,
      checkIn: t.timesheet.checkIn,
      checkOut: t.timesheet.checkOut,
      worked: t.timesheet.workedTime,
      late: t.timesheet.lateMinutes,
      earlyLeave: t.timesheet.earlyLeaveMinutes,
      close: t.common.cancel,
      statusLabels: {
        present: t.timesheet.present,
        working: t.timesheet.working,
        lateMorning: t.timesheet.lateMorning,
        absentMorning: t.timesheet.absentMorning,
        earlyLeaveMorning: t.timesheet.earlyLeaveMorning,
        lateAfternoon: t.timesheet.lateAfternoon,
        absentAfternoon: t.timesheet.absentAfternoon,
        earlyLeaveAfternoon: t.timesheet.earlyLeaveAfternoon,
        lateMorning_earlyLeaveAfternoon: t.timesheet.lateMorningEarlyLeaveAfternoon,
        lateMorning_absentAfternoon: t.timesheet.lateMorningAbsentAfternoon,
        absentMorning_lateAfternoon: t.timesheet.absentMorningLateAfternoon,
        absentMorning_earlyLeaveAfternoon: t.timesheet.absentMorningEarlyLeaveAfternoon,
        absentAfternoon_earlyLeaveMorning: t.timesheet.absentAfternoonEarlyLeaveMorning,
        lateAfternoon_earlyLeaveAfternoon: t.timesheet.lateAfternoonEarlyLeaveAfternoon,
        missing: t.timesheet.missing,
        absent: t.timesheet.absent,
      } as Record<CalendarStatus, string>,
      dayCredit: t.timesheet.dayCredit,
      dayCreditLabels: {
        FULL: t.timesheet.dayCreditValues.FULL,
        HALF: t.timesheet.dayCreditValues.HALF,
        NONE: t.timesheet.dayCreditValues.NONE,
      },
      noteTitle: t.notes.title,
      notePlaceholder: t.notes.placeholder,
      noteSaved: t.common.save,
      noteEdit: t.notes.edit,
      noteSaveChanges: t.notes.saveChanges,
      noteCancel: t.notes.cancelEdit,
      noteSaveSuccess: t.notes.saveSuccess,
      noteSaveError: t.notes.saveError,
      noteLoading: t.notes.loadingNote,
    }),
    [t, language],
  )

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
      {/* Statistics Cards */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {t.dashboard.quickStats}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.workedUnits}</p>
            <p className="text-[10px] uppercase text-muted-foreground">{t.users.workedDays}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{stats.missingUnits}</p>
            <p className="text-[10px] uppercase text-muted-foreground">{t.users.leaveDays}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.lateCount}</p>
            <p className="text-[10px] uppercase text-muted-foreground">{t.timesheet.lateMinutes}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.earlyLeaveCount}</p>
            <p className="text-[10px] uppercase text-muted-foreground">{t.timesheet.earlyLeaveMinutes}</p>
          </div>
        </CardContent>
      </Card>

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
            <MonthCalendar
              currentMonth={currentMonth}
              days={days}
              onMonthChange={setCurrentMonth}
              onDayClick={(d) => {
                setSelectedDay(d)
                setDrawerOpen(true)
              }}
              labels={calendarLabels}
            />
          )}
        </CardContent>
      </Card>

      <DayDetailsSheet
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        day={selectedDay}
        mode="admin"
        userId={userId}
        labels={sheetLabels}
        onEdit={async (data) => {
          if (!selectedDay || !(selectedDay as any).sessionId) {
            toast.error(t.users.detail.sessionNotFound)
            return
          }
          const sessionId = (selectedDay as any).sessionId
          try {
            const res = await adminApi.updateAttendance(sessionId, data)
            if (res.error) {
              toast.error(res.error.message || t.users.detail.updateAttendanceError)
              // Throw error to prevent form from closing
              throw new Error(res.error.message || t.users.detail.updateAttendanceError)
            }
            
            // Only on success: show success message and reload data
            toast.success(t.users.detail.updateAttendanceSuccess)
            
            // Reload data
            const from = toLocalYMD(startOfMonth(currentMonth))
            const to = toLocalYMD(endOfMonth(currentMonth))
            const attendanceRes = await adminApi.getAttendance({ from, to, userId })
            if (attendanceRes.data) {
              const convertedRecords = attendanceRes.data.rows.map((row) => ({
                id: row.id,
                workDate: row.workDate,
                checkInAt: row.checkInAt,
                checkOutAt: row.checkOutAt,
                workedMinutes: row.workedMinutes,
                dayUnit: row.dayUnit,
                notePreview: null,
                status: row.status,
                isLeave: false,
                isUnpaidLeave: false,
              }))
              setRecords(convertedRecords as any)
              
              // Update selectedDay with new data
              const updatedRecord = convertedRecords.find((r) => r.id === sessionId)
              if (updatedRecord && selectedDay) {
                const updatedDay: DayData = {
                  ...selectedDay,
                  checkInAt: updatedRecord.checkInAt,
                  checkOutAt: updatedRecord.checkOutAt,
                  workedMinutes: updatedRecord.workedMinutes,
                }
                setSelectedDay(updatedDay)
              }
            }
            
            // Close editing mode only on success
            // This will be handled by the DayDetailsSheet component
            // We need to pass a callback or use a ref to close it
          } catch (err) {
            console.error("Failed to update attendance:", err)
            toast.error(t.users.detail.updateAttendanceError)
            // Don't close form on error
          }
        }}
      />
    </div>
  )
}

// Leave Tab Component
function UserLeaveTab({ userId }: { userId: number }) {
  const { t, language } = useI18n()
  const [summaries, setSummaries] = useState<LeaveMonthlySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await adminApi.getLeaveSummaries({
          userId,
          year: filter.year,
          month: filter.month,
        })
        if (res.data) {
          setSummaries(res.data)
        } else {
          setSummaries([])
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [userId, filter])

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle>{t.users.detail.leaveSummary}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.users.detail.year}</Label>
            <Input
              type="number"
              value={filter.year}
              onChange={(e) => setFilter({ ...filter, year: parseInt(e.target.value) || new Date().getFullYear() })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>{t.users.detail.month}</Label>
            <Select
              value={filter.month.toString()}
              onValueChange={(v) => setFilter({ ...filter, month: parseInt(v) })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {language === "vi" ? `Tháng ${m}` : `Month ${m}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
        ) : summaries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t.common.noData}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t.users.detail.expectedUnits}</p>
              <p className="text-2xl font-bold">{summaries[0]?.expectedUnits.toFixed(1) || "0"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t.users.detail.workedUnits}</p>
              <p className="text-2xl font-bold">{summaries[0]?.workedUnits.toFixed(1) || "0"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t.users.detail.missingUnits}</p>
              <p className="text-2xl font-bold text-destructive">{summaries[0]?.missingUnits.toFixed(1) || "0"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t.users.detail.paidUsedUnits}</p>
              <p className="text-2xl font-bold">{summaries[0]?.paidUsedUnits.toFixed(1) || "0"}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
