"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { FileText, History, RefreshCw, Edit2, Sparkles, Calendar } from "lucide-react"
import type { LeaveMonthlySummary, LeaveGrant, User, Department } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function AdminLeavePage() {
  const { t } = useI18n()
  const [summaries, setSummaries] = useState<LeaveMonthlySummary[]>([])
  const [grants, setGrants] = useState<LeaveGrant[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<{
    year: number
    month: number
    userId?: number
    departmentId?: number
  }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  })
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [selectedSummary, setSelectedSummary] = useState<LeaveMonthlySummary | null>(null)
  const [adjustPaidLeave, setAdjustPaidLeave] = useState("")
  const [adjustReason, setAdjustReason] = useState("")

  useEffect(() => {
    loadData()
  }, [filter])

  async function loadData() {
    setIsLoading(true)
    try {
      const [summariesRes, grantsRes, usersRes, deptsRes] = await Promise.all([
        adminApi.getLeaveSummaries(filter),
        adminApi.getLeaveGrants(),
        adminApi.getUsers({ limit: 100 }),
        adminApi.getDepartments(),
      ])

      if (summariesRes.data) setSummaries(summariesRes.data)
      if (grantsRes.data) setGrants(grantsRes.data)
      if (usersRes.data) setUsers(usersRes.data.items || [])
      if (deptsRes.data) setDepartments(deptsRes.data || [])
    } catch (err) {
      console.error("Failed to load data:", err)
      toast.error("Không thể tải dữ liệu")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecalculate = async (summary: LeaveMonthlySummary) => {
    try {
      const res = await adminApi.recalculateLeaveSummary({
        userId: summary.userId,
        year: summary.year,
        month: summary.month,
      })
      if (res.error) {
        toast.error(res.error.message || "Không thể tính lại")
      } else {
        toast.success("Đã tính lại tổng kết")
        loadData()
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra")
    }
  }

  const handleAdjustPaidLeave = async () => {
    if (!selectedSummary) return
    if (!adjustReason.trim()) {
      toast.error("Vui lòng nhập lý do")
      return
    }
    const paidLeave = parseFloat(adjustPaidLeave)
    if (isNaN(paidLeave)) {
      toast.error("Số ngày phép không hợp lệ")
      return
    }

    try {
      const res = await adminApi.adjustPaidLeave({
        userId: selectedSummary.userId,
        year: selectedSummary.year,
        month: selectedSummary.month,
        paidLeave,
        reason: adjustReason,
      })
      if (res.error) {
        toast.error(res.error.message || "Không thể điều chỉnh")
      } else {
        toast.success("Đã điều chỉnh ngày phép")
        setAdjustDialogOpen(false)
        setAdjustPaidLeave("")
        setAdjustReason("")
        loadData()
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra")
    }
  }

  const handleGrantLeave = async () => {
    try {
      const res = await adminApi.grantLeave({
        year: filter.year,
        month: filter.month,
      })
      if (res.error) {
        toast.error(res.error.message || "Không thể phát phép")
      } else {
        toast.success(`Đã phát phép cho tháng ${filter.month}/${filter.year}`)
        loadData()
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra")
    }
  }

  const getUserName = (userId: number) => {
    return users.find((u) => u.id === userId)?.name || `User ${userId}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.nav.adminLeave}</h1>
          <p className="text-muted-foreground">Quản lý phép và công của nhân viên</p>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="summary" className="rounded-lg gap-2">
            <FileText className="h-4 w-4" />
            Tổng kết tháng
          </TabsTrigger>
          <TabsTrigger value="grants" className="rounded-lg gap-2">
            <History className="h-4 w-4" />
            Lịch sử phát phép
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Filter Bar */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Bộ lọc
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Năm</label>
                  <Input
                    type="number"
                    value={filter.year}
                    onChange={(e) => setFilter({ ...filter, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Tháng</label>
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
                          Tháng {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Phòng ban</label>
                  <Select
                    value={filter.departmentId?.toString() || "all"}
                    onValueChange={(v) =>
                      setFilter({ ...filter, departmentId: v === "all" ? undefined : parseInt(v) })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Nhân viên</label>
                  <Select
                    value={filter.userId?.toString() || "all"}
                    onValueChange={(v) =>
                      setFilter({ ...filter, userId: v === "all" ? undefined : parseInt(v) })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Table */}
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50 bg-muted/30">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nhân viên</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Công dự kiến</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Công đã làm</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nghỉ</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Phép đã dùng</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Nghỉ không lương</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Sinh nhật</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i} className="border-border/50">
                        <TableCell>
                          <div className="h-10 w-32 bg-muted rounded-lg animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-12 bg-muted rounded-full animate-pulse" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="h-8 w-8 ml-auto bg-muted rounded-full animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : summaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground font-medium italic">
                        {t.common.noData}
                      </TableCell>
                    </TableRow>
                  ) : (
                    summaries.map((summary) => {
                      const user = users.find((u) => u.id === summary.userId)
                      return (
                        <TableRow key={`${summary.userId}-${summary.year}-${summary.month}`} className="hover:bg-accent/30 border-border/50 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">{getUserName(summary.userId)}</p>
                              {user?.departmentName && (
                                <p className="text-xs text-muted-foreground">{user.departmentName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums">{summary.expectedUnits.toFixed(1)}</TableCell>
                          <TableCell className="tabular-nums">{summary.workedUnits.toFixed(1)}</TableCell>
                          <TableCell className="tabular-nums text-destructive">{summary.missingUnits.toFixed(1)}</TableCell>
                          <TableCell className="tabular-nums">{summary.paidUsedUnits.toFixed(1)}</TableCell>
                          <TableCell className="tabular-nums text-orange-600 dark:text-orange-400">{summary.unpaidUnits.toFixed(1)}</TableCell>
                          <TableCell>
                            {summary.isBirthday ? (
                              <Badge variant="outline" className="border-primary/50 text-primary">
                                Sinh nhật
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl"
                                onClick={() => handleRecalculate(summary)}
                                title="Tính lại"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-xl"
                                onClick={() => {
                                  setSelectedSummary(summary)
                                  setAdjustPaidLeave(user?.paidLeave?.toString() || "0")
                                  setAdjustReason("")
                                  setAdjustDialogOpen(true)
                                }}
                                title="Điều chỉnh phép"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grants" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Lịch sử phát phép</CardTitle>
              <Button className="rounded-xl gap-2" onClick={handleGrantLeave}>
                <Sparkles className="h-4 w-4" />
                Phát phép tháng {filter.month}/{filter.year}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50 bg-muted/30">
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Năm</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Tháng</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Loại</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i} className="border-border/50">
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                        </TableCell>
                        <TableCell>
                          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : grants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-medium italic">
                        {t.common.noData}
                      </TableCell>
                    </TableRow>
                  ) : (
                    grants.map((grant) => (
                      <TableRow key={grant.id} className="hover:bg-accent/30 border-border/50 transition-colors">
                        <TableCell className="tabular-nums">{grant.grantYear}</TableCell>
                        <TableCell className="tabular-nums">Tháng {grant.grantMonth}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {grant.grantType}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDate(grant.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Paid Leave Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Điều chỉnh ngày phép</DialogTitle>
            <DialogDescription>
              {selectedSummary && `Nhân viên: ${getUserName(selectedSummary.userId)} - Tháng ${selectedSummary.month}/${selectedSummary.year}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paidLeave">Số ngày phép *</Label>
              <Input
                id="paidLeave"
                type="number"
                step="0.5"
                value={adjustPaidLeave}
                onChange={(e) => setAdjustPaidLeave(e.target.value)}
                className="rounded-xl"
                placeholder="0.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Lý do *</Label>
              <Textarea
                id="reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Nhập lý do điều chỉnh..."
                className="min-h-[80px] rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} className="rounded-xl">
              Hủy
            </Button>
            <Button onClick={handleAdjustPaidLeave} className="rounded-xl">
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
