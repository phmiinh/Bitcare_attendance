"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api" // Using adminApi for all user and department operations
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, Mail, Shield, Building2, Filter, ArrowUpDown, Edit2, Trash2, Loader2 } from "lucide-react"
import type { User, Department } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

function UserManagementContent() {
  const { t } = useI18n()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [filterRole, setFilterRole] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterDepartment, setFilterDepartment] = useState<string>("all")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
    status: "active" as "active" | "disabled",
    departmentId: undefined as number | undefined,
    birthday: "" as string | "",
  })

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [usersRes, deptsRes] = await Promise.all([
        adminApi.getUsers({ limit: 100 }),
        adminApi.getDepartments(),
      ])
      if (usersRes.data) setUsers(usersRes.data.items || [])
      if (deptsRes.data) setDepartments(deptsRes.data || [])
    } catch (err) {
      console.error("Failed to load users:", err)
      toast.error("Không thể tải danh sách nhân viên")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter users based on search term and filters
  const filteredUsers = useMemo(() => {
    let result = users

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      )
    }

    // Role filter
    if (filterRole !== "all") {
      result = result.filter((u) => u.role === filterRole)
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((u) => u.status === filterStatus)
    }

    // Department filter
    if (filterDepartment !== "all") {
      const deptId = parseInt(filterDepartment)
      result = result.filter((u) => u.departmentId === deptId)
    }

    return result
  }, [users, searchTerm, filterRole, filterStatus, filterDepartment])

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push("ellipsis")
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis")
      }

      pages.push(totalPages)
    }

    return pages
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterRole, filterStatus, filterDepartment])

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Vui lòng điền đầy đủ thông tin")
      return
    }

    setIsCreating(true)
    try {
      const res = await adminApi.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        status: formData.status,
        departmentId: formData.departmentId || null,
        birthday: formData.birthday || null,
      })

      if (res.error) {
        toast.error(res.error.message || t.users.createError)
        return
      }

      if (res.data) {
        toast.success(t.users.createSuccess)
        setIsCreateDialogOpen(false)
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "user",
          status: "active",
          departmentId: undefined,
          birthday: "",
        })
        // Reload users list
        await loadData()
      }
    } catch (err) {
      console.error("Failed to create user:", err)
      toast.error("Có lỗi xảy ra khi tạo nhân viên")
    } finally {
      setIsCreating(false)
    }
  }

  const getRoleBadgeColor = (role: User["role"]) => {
    switch (role) {
      case "admin":
        return "bg-secondary text-secondary-foreground border-border"
      default:
        return "bg-muted text-muted-foreground border-transparent"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.users.title}</h1>
          <p className="text-muted-foreground">{t.users.subtitle}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
        <Button className="rounded-xl h-11 gap-2 shadow-lg shadow-primary/10 transition-transform active:scale-95">
          <UserPlus className="h-4 w-4" />
          {t.users.addUser}
        </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t.users.createUser}</DialogTitle>
              <DialogDescription>{t.users.createUserDesc}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.users.userName} *</Label>
                <Input
                  id="name"
                  placeholder={t.users.userName}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.users.userEmail} *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.users.userPassword} *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t.users.passwordMin}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthday">{t.users.userBirthday}</Label>
                <Input
                  id="birthday"
                  type="date"
                  placeholder={t.users.birthdayPlaceholder}
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">{t.users.userRole}</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "user" | "admin") => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger id="role">
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
                    value={formData.status}
                    onValueChange={(value: "active" | "disabled") => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t.users.statusActive}</SelectItem>
                      <SelectItem value="disabled">{t.users.statusDisabled}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">{t.users.userDepartment}</Label>
                <Select
                  value={formData.departmentId?.toString() || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, departmentId: value === "none" ? undefined : parseInt(value) })
                  }
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder={t.users.selectDepartment} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.users.noDepartment}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.users.creating}
                  </>
                ) : (
                  t.users.createUser
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="border-b border-border/50 px-6 py-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.users.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-border/50 bg-background/50 h-10 w-full"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl border-border/50 h-10 gap-2 flex-1 md:flex-none bg-transparent"
                  >
                    <Filter className="h-4 w-4" />
                    {t.common.filter}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 rounded-xl" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t.users.filterRole}</Label>
                      <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.users.filterAll}</SelectItem>
                          <SelectItem value="user">{t.users.roleUser}</SelectItem>
                          <SelectItem value="admin">{t.users.roleAdmin}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.users.filterStatus}</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.users.filterAll}</SelectItem>
                          <SelectItem value="active">{t.users.statusActive}</SelectItem>
                          <SelectItem value="disabled">{t.users.statusDisabled}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.users.filterDepartment}</Label>
                      <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.users.filterAll}</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => {
                        setFilterRole("all")
                        setFilterStatus("all")
                        setFilterDepartment("all")
                        setIsFilterOpen(false)
                      }}
                    >
                      {t.common.cancel}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                className="rounded-xl border-border/50 h-10 gap-2 flex-1 md:flex-none bg-transparent"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50 bg-muted/30">
                <TableHead className="font-bold text-xs uppercase tracking-widest w-16 text-center">{t.admin.attendanceManagement.stt || "STT"}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest pl-6">{t.users.name}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest">{t.users.role}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest">{t.users.department}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest">{t.users.status}</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-widest text-right pr-12">
                  {t.users.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-border/50">
                    <TableCell className="text-center">
                      <div className="h-6 w-8 bg-muted rounded animate-pulse mx-auto" />
                    </TableCell>
                    <TableCell className="pl-6">
                      <div className="h-10 w-40 bg-muted rounded-lg animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-24 bg-muted rounded-lg animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    </TableCell>
                    <TableCell className="pr-12">
                      <div className="h-8 w-24 ml-auto bg-muted rounded-lg animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-medium italic">
                    {t.common.noData}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((u, index) => {
                  const dept = departments.find((d) => d.id === u.departmentId)
                  return (
                    <TableRow key={u.id} className="hover:bg-accent/30 border-border/50 transition-colors h-16">
                      <TableCell className="text-center">
                        <span className="text-sm font-semibold">
                          {startIndex + index + 1}
                        </span>
                      </TableCell>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm leading-tight">{u.name}</span>
                            <span className="text-[10px] font-semibold flex items-center gap-1">
                              <Mail className="h-2 w-2" /> {u.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest rounded-full",
                            getRoleBadgeColor(u.role),
                          )}
                        >
                          <Shield className="h-2 w-2 mr-1" />
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <Building2 className="h-3 w-3" />
                          {dept?.name || t.users.unassigned}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest rounded-full",
                            u.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/50"
                              : "bg-muted text-muted-foreground border-transparent",
                          )}
                        >
                          {u.status === "active" ? t.users.statusActive : t.users.statusDisabled}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-12">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-2"
                          onClick={() => router.push(`/dashboard/admin/users/${u.id}`)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          {t.users.viewDetails}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}

export default function UserManagementPage() {
  return (
    <Suspense fallback={null}>
      <UserManagementContent />
    </Suspense>
  )
}
