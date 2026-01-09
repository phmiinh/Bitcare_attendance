"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Eye, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react"
import type { User, AdminAttendanceRow, LeaveMonthlySummary, AttendanceRecord, Department } from "@/lib/types"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ExportButton } from "@/components/export/export-button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

interface UserStats {
  userId: number
  userName: string
  userEmail: string
  departmentName?: string | null
  workedUnits: number
  missingUnits: number
  lateCount: number
  earlyLeaveCount: number
}

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

// Calculate late and early leave counts based on attendance records
// This uses simplified logic - for detailed calculation, refer to UserAttendanceTab
function calculateLateEarly(records: AdminAttendanceRow[]): { lateCount: number; earlyLeaveCount: number } {
  let lateCount = 0
  let earlyLeaveCount = 0

  records.forEach((r) => {
    // Skip if not a working day (dayUnit = 0)
    if (r.dayUnit === 0) return

    const ciMin = minutesSinceMidnight(r.checkInAt)
    const coMin = minutesSinceMidnight(r.checkOutAt)

    if (!ciMin) return

    // Calculate late: check-in after 8:30
    const workStart = 8 * 60 + 30 // 8:30 AM
    if (ciMin > workStart) {
      lateCount++
    }

    // Calculate early leave: check-out before 18:00 and status is CLOSED
    // Only count if already checked out
    if (coMin && r.status === "CLOSED") {
      const workEnd = 18 * 60 // 6:00 PM
      // Don't count if checkout before 12:00 (that's considered absent afternoon, not early leave)
      if (coMin >= 12 * 60 && coMin < workEnd) {
        earlyLeaveCount++
      }
    }
  })

  return { lateCount, earlyLeaveCount }
}

type SortField = "workedUnits" | "missingUnits" | "lateCount" | "earlyLeaveCount" | null
type SortDirection = "asc" | "desc" | null

export default function AdminAttendancePage() {
  const { t, language } = useI18n()
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState(() => new Date())
  const [users, setUsers] = useState<User[]>([])
  const [userStats, setUserStats] = useState<UserStats[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    loadData()
    setCurrentPage(1) // Reset to first page when month changes
  }, [selectedMonth])

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filter or sort changes
  }, [selectedDepartment, sortField, sortDirection])

  async function loadDepartments() {
    try {
      const res = await adminApi.getDepartments()
      if (res.data) {
        setDepartments(res.data)
      }
    } catch (err) {
      console.error("Failed to load departments:", err)
    }
  }

  async function loadData() {
    setIsLoading(true)
    try {
      // Fetch all users
      const usersRes = await adminApi.getUsers({ limit: 1000 })
      if (!usersRes.data?.items) {
        toast.error("Không thể tải danh sách nhân viên")
        return
      }

      const allUsers = usersRes.data.items
      setUsers(allUsers)

      // Calculate statistics for each user
      const from = toLocalYMD(startOfMonth(selectedMonth))
      const to = toLocalYMD(endOfMonth(selectedMonth))
      const year = selectedMonth.getFullYear()
      const month = selectedMonth.getMonth() + 1

      const statsPromises = allUsers.map(async (user): Promise<UserStats> => {
        try {
          const [attendanceRes, leaveRes] = await Promise.all([
            adminApi.getAttendance({ from, to, userId: user.id }),
            adminApi.getLeaveSummaries({ userId: user.id, year, month }),
          ])

          const records = attendanceRes.data?.rows || []
          const summary = leaveRes.data?.[0]

          // Calculate late and early leave counts
          const { lateCount, earlyLeaveCount } = calculateLateEarly(records)

          return {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            departmentName: user.departmentName,
            workedUnits: summary ? Math.round((summary.workedUnits || 0) * 10) / 10 : 0,
            missingUnits: summary ? Math.round((summary.missingUnits || 0) * 10) / 10 : 0,
            lateCount,
            earlyLeaveCount,
          }
        } catch (err) {
          console.error(`Failed to load stats for user ${user.id}:`, err)
          return {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            departmentName: user.departmentName,
            workedUnits: 0,
            missingUnits: 0,
            lateCount: 0,
            earlyLeaveCount: 0,
          }
        }
      })

      const stats = await Promise.all(statsPromises)
      setUserStats(stats)
    } catch (err) {
      console.error("Failed to load data:", err)
      toast.error("Không thể tải dữ liệu")
    } finally {
      setIsLoading(false)
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
          value: `${y}-${String(m + 1).padStart(2, "0")}`,
          label: d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" }),
        })
      }
    }
    return opts
  }, [language])

  const handleViewDetails = (userId: number) => {
    router.push(`/dashboard/admin/users/${userId}?tab=attendance`)
  }

  // Filter and sort stats
  const filteredAndSortedStats = useMemo(() => {
    let filtered = userStats

    // Filter by department
    if (selectedDepartment !== null) {
      filtered = filtered.filter((stat) => {
        // Find user to get department ID
        const user = users.find((u) => u.id === stat.userId)
        return user?.departmentId === selectedDepartment
      })
    }

    // Sort
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortField]
        const bValue = b[sortField]
        if (sortDirection === "asc") {
          return aValue - bValue
        } else {
          return bValue - aValue
        }
      })
    }

    return filtered
  }, [userStats, selectedDepartment, sortField, sortDirection, users])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortField(null)
        setSortDirection(null)
      }
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />
    }
    return <ArrowDown className="h-4 w-4 ml-1" />
  }

  // Export functions
  const handleExportCSV = async () => {
    const monthStr = selectedMonth.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
      month: "long",
      year: "numeric",
    })

    const headers = [
      t.admin.attendanceManagement.stt,
      t.admin.attendanceManagement.employee,
      t.admin.attendanceManagement.department,
      t.admin.attendanceManagement.workedUnits,
      t.admin.attendanceManagement.leaveDays,
      t.admin.attendanceManagement.lateCount,
      t.admin.attendanceManagement.earlyLeaveCount,
    ]

    const rows = filteredAndSortedStats.map((stat, index) => [
      index + 1,
      stat.userName,
      stat.departmentName || "-",
      stat.workedUnits,
      stat.missingUnits,
      stat.lateCount,
      stat.earlyLeaveCount,
    ])

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance_${monthStr.replace(/\s+/g, "_")}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleExportExcel = async () => {
    // For Excel, we'll export as CSV but with .xlsx extension
    // In a real implementation, you might want to use a library like xlsx
    await handleExportCSV()
    toast.info("Đang xuất CSV (Excel format sẽ được hỗ trợ sau)")
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedStats.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedStats = filteredAndSortedStats.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push("ellipsis")
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis")
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t.admin.attendanceManagement.title || "Quản lý chấm công"}
          </h1>
          <p className="text-muted-foreground">
            {t.admin.attendanceManagement.subtitle || "Thống kê trạng thái chấm công theo tháng của toàn bộ nhân viên"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedDepartment?.toString() || "all"}
            onValueChange={(v) => {
              setSelectedDepartment(v === "all" ? null : parseInt(v))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="rounded-xl w-[180px]">
              <SelectValue placeholder={t.admin.attendanceManagement.department || "Phòng ban"} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">{t.common.selectAll || "Tất cả"}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`}
            onValueChange={(v) => {
              const [year, month] = v.split("-").map(Number)
              setSelectedMonth(new Date(year, month - 1, 1))
            }}
          >
            <SelectTrigger className="rounded-xl w-[200px]">
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
            className="rounded-xl"
            onClick={() => setSelectedMonth(new Date())}
          >
            {t.dateTime.thisMonth || "Tháng này"}
          </Button>
          <ExportButton
            onExportCSV={handleExportCSV}
            onExportExcel={handleExportExcel}
            disabled={filteredAndSortedStats.length === 0}
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Statistics Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50 bg-muted/30">
                <TableHead className="font-bold text-xs uppercase tracking-widest w-16 text-center">{t.admin.attendanceManagement.stt}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest">{t.admin.attendanceManagement.employee}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest">{t.admin.attendanceManagement.department || "Phòng ban"}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest text-right">
                  <button
                    onClick={() => handleSort("workedUnits")}
                    className="flex items-center justify-end w-full hover:opacity-70 transition-opacity"
                  >
                    {t.admin.attendanceManagement.workedUnits}
                    {getSortIcon("workedUnits")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest text-right">
                  <button
                    onClick={() => handleSort("missingUnits")}
                    className="flex items-center justify-end w-full hover:opacity-70 transition-opacity"
                  >
                    {t.admin.attendanceManagement.leaveDays}
                    {getSortIcon("missingUnits")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest text-right">
                  <button
                    onClick={() => handleSort("lateCount")}
                    className="flex items-center justify-end w-full hover:opacity-70 transition-opacity"
                  >
                    {t.admin.attendanceManagement.lateCount}
                    {getSortIcon("lateCount")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest text-right">
                  <button
                    onClick={() => handleSort("earlyLeaveCount")}
                    className="flex items-center justify-end w-full hover:opacity-70 transition-opacity"
                  >
                    {t.admin.attendanceManagement.earlyLeaveCount}
                    {getSortIcon("earlyLeaveCount")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest text-right">{t.admin.attendanceManagement.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    <TableCell className="text-center">
                      <div className="h-6 w-8 bg-muted rounded animate-pulse mx-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-6 w-16 bg-muted rounded animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-6 w-16 bg-muted rounded animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-6 w-12 bg-muted rounded animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-6 w-12 bg-muted rounded animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-8 w-24 bg-muted rounded-xl animate-pulse ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredAndSortedStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground font-medium italic">
                    {t.common.noData || "Không có dữ liệu"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStats.map((stat, index) => (
                  <TableRow key={stat.userId} className="hover:bg-accent/30 border-border/50 transition-colors">
                    <TableCell className="text-center">
                      <span className="text-sm font-semibold">
                        {startIndex + index + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-sm">{stat.userName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold">{stat.departmentName || "-"}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-semibold">
                        {stat.workedUnits}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-semibold">
                        {stat.missingUnits}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-semibold">
                        {stat.lateCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-semibold">
                        {stat.earlyLeaveCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-2"
                        onClick={() => handleViewDetails(stat.userId)}
                      >
                        <Eye className="h-4 w-4" />
                        {t.admin.attendanceManagement.viewDetails || "Xem chi tiết"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
