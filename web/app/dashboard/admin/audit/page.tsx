"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { History, Filter, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import type { AuditLog, AuditLogFilter, User } from "@/lib/types"
import { formatDate, formatTime } from "@/lib/utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function AdminAuditPage() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<AuditLogFilter>({
    limit: 50,
    offset: 0,
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [filter])

  async function loadData() {
    setIsLoading(true)
    try {
      const [logsRes, usersRes] = await Promise.all([
        adminApi.getAuditLogs(filter),
        adminApi.getUsers({ limit: 100 }),
      ])

      if (logsRes.data) {
        setLogs(logsRes.data.items)
        setTotal(logsRes.data.total)
      }
      if (usersRes.data) {
        setUsers(usersRes.data.items || [])
      }
    } catch (err) {
      console.error("Failed to load data:", err)
      toast.error("Không thể tải dữ liệu")
    } finally {
      setIsLoading(false)
    }
  }

  const getUserName = (userId: number) => {
    return users.find((u) => u.id === userId)?.name || `User ${userId}`
  }

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      CREATE: "Tạo mới",
      UPDATE: "Cập nhật",
      DELETE: "Xóa",
      CLOSE: "Đóng session",
      ADJUST: "Điều chỉnh",
      RECALCULATE: "Tính lại",
      GRANT: "Phát phép",
    }
    return labels[actionType] || actionType
  }

  const getEntityTypeLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      attendance_session: "Chấm công",
      work_calendar: "Lịch làm việc",
      user: "Nhân viên",
      leave: "Phép",
      leave_summary: "Tổng kết phép",
    }
    return labels[entityType] || entityType
  }

  const getActionTypeColor = (actionType: string) => {
    const colors: Record<string, string> = {
      CREATE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      UPDATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      DELETE: "bg-destructive/10 text-destructive border-destructive/20",
      CLOSE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      ADJUST: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      RECALCULATE: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      GRANT: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    }
    return colors[actionType] || "bg-muted text-muted-foreground border-transparent"
  }

  const handlePageChange = (newOffset: number) => {
    setFilter({ ...filter, offset: newOffset })
  }

  const currentPage = Math.floor((filter.offset || 0) / (filter.limit || 50)) + 1
  const totalPages = Math.ceil(total / (filter.limit || 50))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.nav.adminAudit}</h1>
          <p className="text-muted-foreground">Nhật ký thao tác của quản trị viên</p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Từ ngày</label>
              <Input
                type="date"
                value={filter.from || ""}
                onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined, offset: 0 })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Đến ngày</label>
              <Input
                type="date"
                value={filter.to || ""}
                onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined, offset: 0 })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Loại thao tác</label>
              <Select
                value={filter.actionType || "all"}
                onValueChange={(v) => setFilter({ ...filter, actionType: v === "all" ? undefined : v, offset: 0 })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="CREATE">Tạo mới</SelectItem>
                  <SelectItem value="UPDATE">Cập nhật</SelectItem>
                  <SelectItem value="DELETE">Xóa</SelectItem>
                  <SelectItem value="CLOSE">Đóng session</SelectItem>
                  <SelectItem value="ADJUST">Điều chỉnh</SelectItem>
                  <SelectItem value="RECALCULATE">Tính lại</SelectItem>
                  <SelectItem value="GRANT">Phát phép</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Loại đối tượng</label>
              <Select
                value={filter.entityType || "all"}
                onValueChange={(v) => setFilter({ ...filter, entityType: v === "all" ? undefined : v, offset: 0 })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="attendance_session">Chấm công</SelectItem>
                  <SelectItem value="work_calendar">Lịch làm việc</SelectItem>
                  <SelectItem value="user">Nhân viên</SelectItem>
                  <SelectItem value="leave">Phép</SelectItem>
                  <SelectItem value="leave_summary">Tổng kết phép</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Quản trị viên</label>
              <Select
                value={filter.adminUserId?.toString() || "all"}
                onValueChange={(v) =>
                  setFilter({ ...filter, adminUserId: v === "all" ? undefined : parseInt(v), offset: 0 })
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

      {/* Table */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50 bg-muted/30">
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Thời gian</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Quản trị viên</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Thao tác</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Đối tượng</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">ID đối tượng</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Lý do</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    <TableCell>
                      <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-8 w-8 ml-auto bg-muted rounded-full animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium italic">
                    {t.common.noData}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-accent/30 border-border/50 transition-colors">
                    <TableCell className="tabular-nums">
                      <div>
                        <p className="text-sm font-medium">{formatDate(log.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(log.createdAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{getUserName(log.adminUserId)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-widest", getActionTypeColor(log.actionType))}>
                        {getActionTypeLabel(log.actionType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{getEntityTypeLabel(log.entityType)}</p>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      <p className="text-sm font-mono">{log.entityId}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {log.reason || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl"
                        onClick={() => {
                          setSelectedLog(log)
                          setDetailDialogOpen(true)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Hiển thị {filter.offset! + 1} - {Math.min(filter.offset! + (filter.limit || 50), total)} trong tổng số {total} bản ghi
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => handlePageChange(Math.max(0, (filter.offset || 0) - (filter.limit || 50)))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <span className="text-sm font-medium">
              Trang {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => handlePageChange((filter.offset || 0) + (filter.limit || 50))}
              disabled={currentPage >= totalPages}
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết nhật ký</DialogTitle>
            <DialogDescription>
              {selectedLog && `Thao tác ${getActionTypeLabel(selectedLog.actionType)} trên ${getEntityTypeLabel(selectedLog.entityType)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Thời gian</p>
                  <p className="text-sm font-medium">
                    {formatDate(selectedLog.createdAt)} {formatTime(selectedLog.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Quản trị viên</p>
                  <p className="text-sm font-medium">{getUserName(selectedLog.adminUserId)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Thao tác</p>
                  <Badge variant="outline" className={cn(getActionTypeColor(selectedLog.actionType))}>
                    {getActionTypeLabel(selectedLog.actionType)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Đối tượng</p>
                  <p className="text-sm font-medium">{getEntityTypeLabel(selectedLog.entityType)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">ID đối tượng</p>
                  <p className="text-sm font-mono">{selectedLog.entityId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Lý do</p>
                  <p className="text-sm">{selectedLog.reason || "—"}</p>
                </div>
              </div>

              {(selectedLog.beforeJson || selectedLog.afterJson) && (
                <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-border/50">
                  {selectedLog.beforeJson && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Trước khi thay đổi</p>
                      <pre className="text-xs bg-muted p-3 rounded-xl overflow-x-auto max-h-[200px] overflow-y-auto">
                        {JSON.stringify(selectedLog.beforeJson, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.afterJson && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Sau khi thay đổi</p>
                      <pre className="text-xs bg-muted p-3 rounded-xl overflow-x-auto max-h-[200px] overflow-y-auto">
                        {JSON.stringify(selectedLog.afterJson, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)} className="rounded-xl">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
