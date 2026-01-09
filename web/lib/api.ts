import type {
  ApiResponse,
  LoginCredentials,
  AuthUser,
  User,
  Department,
  AttendanceToday,
  AttendanceRow,
  AttendanceRecord,
  AttendanceListResponse,
  Note,
  StatsMe,
  AdminOverview,
  AdminTodayOps,
  AdminTopIssues,
  AdminAttendanceRow,
  AdminAttendanceListResponse,
  AdminAttendanceFilter,
  WorkCalendarDay,
  WorkCalendarBulkUpdate,
  LeaveMonthlySummary,
  LeaveGrant,
  AuditLog,
  AuditLogListResponse,
  AuditLogFilter,
  UserFilter,
  DateFilter,
  PaginatedResponse,
} from "./types"

const API_BASE = "/api/v1"
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type FetchOptions = RequestInit & {
  json?: any
}

async function apiFetch<T>(path: string, options: FetchOptions = {}, retry = true): Promise<ApiResponse<T>> {
  const { json, headers, ...rest } = options

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
    credentials: "include",
  })

  const contentType = res.headers.get("content-type") || ""
  const isJSON = contentType.includes("application/json")
  const payload = isJSON ? await res.json() : null

  if (res.status === 401 && retry) {
    // try refresh token once
    const rf = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    if (rf.ok) {
      // retry original
      return apiFetch<T>(path, options, false)
    }
  }

  if (!res.ok) {
    return payload || { error: { code: "network_error", message: "Request failed" } }
  }

  return payload as ApiResponse<T>
}

const mockUsers: (User & { password: string })[] = [
  {
    id: 1,
    name: "Nguyen Van A",
    email: "user@example.com",
    password: "password123",
    role: "user",
    status: "active",
    departmentId: 1,
    departmentName: "Engineering",
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: 2,
    name: "Tran Thi B",
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
    status: "active",
    departmentId: 2,
    departmentName: "Marketing",
    createdAt: "2024-01-10T00:00:00Z",
  },
  {
    id: 3,
    name: "Le Van C",
    email: "user2@example.com",
    password: "password123",
    role: "user",
    status: "active",
    departmentId: 1,
    departmentName: "Engineering",
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: 4,
    name: "Pham Thi D",
    email: "user3@example.com",
    password: "password123",
    role: "user",
    status: "disabled",
    departmentId: 3,
    departmentName: "Sales",
    createdAt: "2024-02-15T00:00:00Z",
  },
]

const mockDepartments: Department[] = [
  { id: 1, name: "Engineering", code: "ENG", headcount: 25 },
  { id: 2, name: "Marketing", code: "MKT", headcount: 12 },
  { id: 3, name: "Sales", code: "SAL", headcount: 18 },
  { id: 4, name: "HR", code: "HR", headcount: 5 },
]

const mockNotes: Note[] = [
  {
    id: 1,
    userId: 1,
    date: "2024-12-30",
    content: "Team meeting scheduled for 2 PM. Need to prepare presentation slides.",
    createdAt: "2024-12-30T10:00:00Z",
  },
  {
    id: 2,
    userId: 1,
    date: "2024-12-29",
    content: "Completed code review for PR #123.",
    createdAt: "2024-12-29T14:30:00Z",
  },
]

let currentUser: AuthUser | null = null

export const authApi = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: AuthUser }>> {
    const res = await apiFetch<{ user: { id: number; name: string; email: string; role: string } }>("/auth/login", {
      method: "POST",
      json: credentials,
    })

    if (res.data?.user) {
      const authUser: AuthUser = {
        id: res.data.user.id,
        name: res.data.user.name,
        email: res.data.user.email,
        role: res.data.user.role as UserRole,
        status: "active",
        departmentId: null,
        departmentName: null,
      }
      return { data: { user: authUser } }
    }

    return res as ApiResponse<{ user: AuthUser }>
  },

  async logout(): Promise<ApiResponse<void>> {
    return apiFetch<void>("/auth/logout", { method: "POST" })
  },

  async getMe(): Promise<ApiResponse<AuthUser>> {
    const res = await apiFetch<{
      id: number
      name: string
      email: string
      role: string
      status: string
      departmentId?: number | null
      departmentName?: string | null
      birthday?: string | null
      paidLeave?: number
    }>("/me", { method: "GET" })

    if (res.data) {
      const authUser: AuthUser = {
        id: res.data.id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role as UserRole,
        status: res.data.status as UserStatus,
        departmentId: res.data.departmentId ?? null,
        departmentName: res.data.departmentName ?? null,
        birthday: res.data.birthday ?? null,
        paidLeave: res.data.paidLeave,
      }
      return { data: authUser }
    }

    return res as ApiResponse<AuthUser>
  },
}

// Helper to format time from ISO string to HH:MM:SS
function formatTimeFromISO(iso: string | null): string | null {
  if (!iso) return null
  try {
    const date = new Date(iso)
    return date.toTimeString().slice(0, 8) // HH:MM:SS
  } catch {
    return null
  }
}

export const attendanceApi = {
  async getToday(): Promise<ApiResponse<AttendanceToday>> {
    const res = await apiFetch<{
      workDate: string
      checkInAt: string | null
      checkOutAt: string | null
      workedMinutes: number
      dayUnit: number
      dayUnit: string
      status: string
    }>("/attendance/today", { method: "GET" })

    if (res.data) {
      return {
        data: {
          workDate: res.data.workDate,
          checkInAt: formatTimeFromISO(res.data.checkInAt),
          checkOutAt: formatTimeFromISO(res.data.checkOutAt),
          workedMinutes: res.data.workedMinutes,
          dayUnit: res.data.dayUnit as 0 | 0.5 | 1,
          dayPart: res.data.dayPart as "NONE" | "HALF" | "FULL",
          status: res.data.status as "NOT_CHECKED_IN" | "OPEN" | "CLOSED",
        },
      }
    }
    return res as ApiResponse<AttendanceToday>
  },

  async checkIn(): Promise<ApiResponse<AttendanceToday>> {
    const res = await apiFetch<{
      workDate: string
      checkInAt: string | null
      checkOutAt: string | null
      workedMinutes: number
      dayUnit: number
      dayPart: string
      status: string
    }>("/attendance/check-in", { method: "POST" })

    if (res.data) {
      return {
        data: {
          workDate: res.data.workDate,
          checkInAt: formatTimeFromISO(res.data.checkInAt),
          checkOutAt: formatTimeFromISO(res.data.checkOutAt),
          workedMinutes: res.data.workedMinutes,
          dayUnit: res.data.dayUnit as 0 | 0.5 | 1,
          dayPart: res.data.dayPart as "NONE" | "HALF" | "FULL",
          status: res.data.status as "NOT_CHECKED_IN" | "OPEN" | "CLOSED",
        },
      }
    }
    return res as ApiResponse<AttendanceToday>
  },

  async checkOut(): Promise<ApiResponse<AttendanceToday>> {
    const res = await apiFetch<{
      workDate: string
      checkInAt: string | null
      checkOutAt: string | null
      workedMinutes: number
      dayUnit: number
      dayPart: string
      status: string
    }>("/attendance/check-out", { method: "POST" })

    if (res.data) {
      return {
        data: {
          workDate: res.data.workDate,
          checkInAt: formatTimeFromISO(res.data.checkInAt),
          checkOutAt: formatTimeFromISO(res.data.checkOutAt),
          workedMinutes: res.data.workedMinutes,
          dayUnit: res.data.dayUnit as 0 | 0.5 | 1,
          dayPart: res.data.dayPart as "NONE" | "HALF" | "FULL",
          status: res.data.status as "NOT_CHECKED_IN" | "OPEN" | "CLOSED",
        },
      }
    }
    return res as ApiResponse<AttendanceToday>
  },

  async listMe(filter?: { startDate?: string; endDate?: string }): Promise<ApiResponse<AttendanceListResponse>> {
    const qs = new URLSearchParams()
    if (filter?.startDate) qs.set("from", filter.startDate)
    if (filter?.endDate) qs.set("to", filter.endDate)
    return apiFetch<AttendanceListResponse>(`/attendance/me${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },

  async getMyAttendance(filter?: DateFilter): Promise<ApiResponse<AttendanceRow[]>> {
    const res = await this.listMe({ startDate: filter?.from, endDate: filter?.to })
    if (res.data) {
      const rows: AttendanceRow[] = res.data.rows.map((row) => ({
        workDate: row.workDate,
        checkInAt: formatTimeFromISO(row.checkInAt),
        checkOutAt: formatTimeFromISO(row.checkOutAt),
        workedMinutes: row.workedMinutes,
        dayUnit: row.dayUnit,
        dayPart: row.dayPart as "NONE" | "HALF" | "FULL",
        notePreview: row.notePreview,
        status: row.status as "OPEN" | "CLOSED" | "MISSING",
        isLeave: (row as any).isLeave || false,
        isUnpaidLeave: (row as any).isUnpaidLeave || false,
      }))
      return { data: rows }
    }
    return res as ApiResponse<AttendanceRow[]>
  },

  async getByUser(userId: number, filter?: DateFilter): Promise<ApiResponse<AttendanceRow[]>> {
    return this.getMyAttendance(filter)
  },
}

// Notes API
// Prefer real backend if available; fallback to local mock storage.
type GetMeResponse = { workDate: string; content: string }

type PutMeResponse = { workDate: string; content: string; updatedAt: string }

export const notesApi = {
  async getMyNotes(date?: string, userId?: number): Promise<ApiResponse<Note | null>> {
    if (!date) return { data: null }
    
    // Call BE endpoint: GET /notes/me?date=YYYY-MM-DD
    const qs = new URLSearchParams({ date })
    const res = await apiFetch<GetMeResponse>(`/notes/me?${qs}`, { 
      method: "GET" 
    })
    
    if (!res.error && res.data) {
      // Map BE response to FE Note type
      return { 
        data: { 
          id: 0, // BE doesn't return ID
          userId: userId || 0,
          date,
          content: res.data.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } 
      }
    }

    // Fallback to local mock if BE fails
    await delay(200)
    const uid = userId ?? currentUser?.id
    const note = mockNotes.find((n) => n.userId === uid && n.date === date)
    return { data: note || null }
  },

  async updateMyNote(date: string, content: string, userId?: number): Promise<ApiResponse<Note>> {
    // Try backend first (BE uses PUT /notes/me?date=YYYY-MM-DD)
    const qs = new URLSearchParams()
    if (date) qs.set("date", date)
    const res = await apiFetch<PutMeResponse>(`/notes/me?${qs.toString()}`, {
      method: "PUT",
      json: { content },
    })
    if (!res.error && res.data) {
      return {
        data: {
          id: 0,
          userId: userId || 0,
          date,
          content: res.data.content,
          updatedAt: res.data.updatedAt,
        },
      }
    }

    // Fallback to local mock
    await delay(200)
    const uid = userId ?? currentUser?.id
    if (!uid) {
      return { error: { code: "UNAUTHORIZED", message: "Unauthorized" } }
    }

    const existingNote = mockNotes.find((n) => n.userId === uid && n.date === date)
    if (existingNote) {
      existingNote.content = content
      existingNote.updatedAt = new Date().toISOString()
      return { data: existingNote }
    }

    const newNote: Note = {
      id: mockNotes.length + 1,
      userId: uid,
      date,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockNotes.push(newNote)
    return { data: newNote }
  },
}

export const statsApi = {
  async getMyStats(month?: string, year?: string): Promise<ApiResponse<StatsMe>> {
    // Default to current month if not provided
    if (!month && !year) {
      const now = new Date()
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    }

    const qs = new URLSearchParams()
    if (month) {
      qs.set("month", month)
    } else if (year) {
      qs.set("year", year)
    }

    const res = await apiFetch<{
      range: string
      totalWorkedMinutes: number
      workedDays: number
      totalDayUnit: number
      fullDays: number
      halfDays: number
      missingDays: number
      anomalies: {
        total: number
        missingCheckOut: number
        missingCheckIn: number
      }
      prevMonthComparison?: {
        workedMinutesDelta: number
        dayUnitDelta: number
        workedDaysDelta: number
      }
      series: Array<{
        workDate: string
        workedMinutes: number
        dayUnit: number
        anomalies: {
          total: number
          missingCheckOut: number
          missingCheckIn: number
        }
      }>
    }>(`/stats/me?${qs.toString()}`, { method: "GET" })

    if (res.error) {
      return res
    }

    return {
      data: {
        totalWorkedMinutes: res.data?.totalWorkedMinutes || 0,
        workedDays: res.data?.workedDays || 0,
        totalDayUnit: res.data?.totalDayUnit || 0,
        fullDays: res.data?.fullDays || 0,
        halfDays: res.data?.halfDays || 0,
        missingDays: res.data?.missingDays || 0,
        anomalies: res.data?.anomalies || { total: 0, missingCheckOut: 0, missingCheckIn: 0 },
        prevMonthComparison: res.data?.prevMonthComparison,
        series: res.data?.series || [],
      },
    }
  },
}

export const adminApi = {
  async getUsers(filter?: UserFilter): Promise<ApiResponse<PaginatedResponse<User>>> {
    const qs = new URLSearchParams()
    if (filter?.query) qs.set("query", filter.query)
    if (filter?.page) qs.set("page", filter.page.toString())
    if (filter?.limit) qs.set("limit", filter.limit.toString())
    if (filter?.departmentId) qs.set("departmentId", filter.departmentId.toString())

    return apiFetch<PaginatedResponse<User>>(`/admin/users${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },

  async createUser(data: Omit<User, "id" | "createdAt"> & { password: string }): Promise<ApiResponse<User>> {
    return apiFetch<User>("/admin/users", {
      method: "POST",
      json: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        status: data.status,
        departmentId: data.departmentId,
        birthday: data.birthday || null,
      },
    })
  },

  async updateUser(id: number, data: Partial<User>): Promise<ApiResponse<User>> {
    return apiFetch<User>(`/admin/users/${id}`, {
      method: "PATCH",
      json: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        status: data.status,
        departmentId: data.departmentId,
        birthday: data.birthday || null,
        paidLeave: data.paidLeave,
      },
    })
  },

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/admin/users/${id}`, { method: "DELETE" })
  },

  async getDepartments(): Promise<ApiResponse<Department[]>> {
    return apiFetch<Department[]>("/admin/departments", { method: "GET" })
  },

  async createDepartment(data: { name: string; code?: string }): Promise<ApiResponse<Department>> {
    return apiFetch<Department>("/admin/departments", {
      method: "POST",
      json: data,
    })
  },

  async updateDepartment(id: number, data: { name?: string; code?: string }): Promise<ApiResponse<Department>> {
    return apiFetch<Department>(`/admin/departments/${id}`, {
      method: "PATCH",
      json: data,
    })
  },

  async deleteDepartment(id: number): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/admin/departments/${id}`, { method: "DELETE" })
  },

  async getUserAttendance(userId: number, month?: string): Promise<ApiResponse<AttendanceRow[]>> {
    await delay(600)

    const mockRows: AttendanceRow[] = [
      {
        workDate: "2024-12-30",
        checkInAt: "08:45:00",
        checkOutAt: "17:30:00",
        workedMinutes: 525,
        dayUnit: 1,
        dayPart: "FULL",
        notePreview: "Working on project X",
        status: "CLOSED",
      },
      {
        workDate: "2024-12-29",
        checkInAt: "09:00:00",
        checkOutAt: "17:00:00",
        workedMinutes: 480,
        dayUnit: 1,
        dayPart: "FULL",
        notePreview: null,
        status: "CLOSED",
      },
    ]

    return { data: mockRows }
  },

  async getOverview(filter?: DateFilter & { departmentId?: number }): Promise<ApiResponse<AdminOverview>> {
    await delay(700)

    const mockOverview: AdminOverview = {
      from: filter?.from || "2024-12-01",
      to: filter?.to || "2024-12-31",
      totalUsers: mockUsers.length,
      checkedInToday: 15,
      notCheckedInToday: 5,
      missingCheckout: 2,
      trend: [
        { workDate: "2024-12-01", totalWorkedMinutes: 7200, totalDayUnit: 15 },
        { workDate: "2024-12-02", totalWorkedMinutes: 7680, totalDayUnit: 16 },
        { workDate: "2024-12-03", totalWorkedMinutes: 6720, totalDayUnit: 14 },
      ],
      topAnomalies: [
        { userId: 4, name: "Pham Thi D", missingCount: 5, departmentName: "Sales" },
        { userId: 3, name: "Le Van C", missingCount: 3, departmentName: "Engineering" },
      ],
    }

    return { data: mockOverview }
  },

  async getTodayOps(): Promise<ApiResponse<AdminTodayOps>> {
    return apiFetch<AdminTodayOps>("/admin/overview/today", { method: "GET" })
  },

  async getTopIssues(): Promise<ApiResponse<AdminTopIssues>> {
    return apiFetch<AdminTopIssues>("/admin/overview/top-issues", { method: "GET" })
  },

  // Admin Attendance API
  async getAttendance(filter?: AdminAttendanceFilter): Promise<ApiResponse<AdminAttendanceListResponse>> {
    const qs = new URLSearchParams()
    if (filter?.from) qs.set("from", filter.from)
    if (filter?.to) qs.set("to", filter.to)
    if (filter?.userId) qs.set("userId", filter.userId.toString())
    if (filter?.departmentId) qs.set("departmentId", filter.departmentId.toString())
    if (filter?.status) qs.set("status", filter.status)
    return apiFetch<AdminAttendanceListResponse>(`/admin/attendance${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },

  async createAttendance(data: {
    userId: number
    workDate: string
    checkInAt: string
    checkOutAt?: string
    reason: string
  }): Promise<ApiResponse<AttendanceToday>> {
    return apiFetch<AttendanceToday>("/admin/attendance", {
      method: "POST",
      json: data,
    })
  },

  async updateAttendance(id: number, data: {
    checkInAt?: string
    checkOutAt?: string
    reason: string
  }): Promise<ApiResponse<AttendanceToday>> {
    return apiFetch<AttendanceToday>(`/admin/attendance/${id}`, {
      method: "PATCH",
      json: data,
    })
  },

  async closeAttendance(id: number, data: {
    checkOutAt: string
    reason: string
  }): Promise<ApiResponse<AttendanceToday>> {
    return apiFetch<AttendanceToday>(`/admin/attendance/${id}/close`, {
      method: "POST",
      json: data,
    })
  },

  async deleteAttendance(id: number): Promise<ApiResponse<void>> {
    return apiFetch<void>(`/admin/attendance/${id}`, { method: "DELETE" })
  },

  // Work Calendar API
  async getWorkCalendar(filter: { from: string; to: string }): Promise<ApiResponse<WorkCalendarDay[]>> {
    const qs = new URLSearchParams()
    qs.set("from", filter.from)
    qs.set("to", filter.to)
    return apiFetch<WorkCalendarDay[]>(`/admin/work-calendar?${qs}`, { method: "GET" })
  },

  async updateWorkCalendarDay(data: {
    date: string
    isWorkingDay: boolean
    workUnit: number
    note?: string | null
  }): Promise<ApiResponse<WorkCalendarDay>> {
    return apiFetch<WorkCalendarDay>("/admin/work-calendar/day", {
      method: "PUT",
      json: data,
    })
  },

  async bulkUpdateWorkCalendar(data: WorkCalendarBulkUpdate): Promise<ApiResponse<{ updated: number }>> {
    return apiFetch<{ updated: number }>("/admin/work-calendar/bulk", {
      method: "POST",
      json: data,
    })
  },

  async generateWorkCalendar(year: number): Promise<ApiResponse<{ year: number; status: string }>> {
    return apiFetch<{ year: number; status: string }>("/admin/work-calendar/generate", {
      method: "POST",
      json: { year },
    })
  },

  // Leave Management API
  async getLeaveSummaries(filter: {
    year?: number
    month?: number
    userId?: number
    departmentId?: number
  }): Promise<ApiResponse<LeaveMonthlySummary[]>> {
    const qs = new URLSearchParams()
    if (filter.year) qs.set("year", filter.year.toString())
    if (filter.month) qs.set("month", filter.month.toString())
    if (filter.userId) qs.set("userId", filter.userId.toString())
    if (filter.departmentId) qs.set("departmentId", filter.departmentId.toString())
    return apiFetch<LeaveMonthlySummary[]>(`/admin/leave/summaries${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },

  async recalculateLeaveSummary(data: {
    userId: number
    year: number
    month: number
  }): Promise<ApiResponse<LeaveMonthlySummary>> {
    const qs = new URLSearchParams()
    qs.set("userId", data.userId.toString())
    qs.set("year", data.year.toString())
    qs.set("month", data.month.toString())
    return apiFetch<LeaveMonthlySummary>(`/admin/leave/summary/recalculate?${qs}`, { method: "POST" })
  },

  async adjustPaidLeave(data: {
    userId: number
    year: number
    month: number
    paidLeave: number
    reason: string
  }): Promise<ApiResponse<LeaveMonthlySummary>> {
    return apiFetch<LeaveMonthlySummary>(`/admin/leave/summary/${data.userId}/${data.year}/${data.month}`, {
      method: "PATCH",
      json: {
        paidLeave: data.paidLeave,
        reason: data.reason,
      },
    })
  },

  async getLeaveGrants(filter?: { year?: number; month?: number }): Promise<ApiResponse<LeaveGrant[]>> {
    const qs = new URLSearchParams()
    if (filter?.year) qs.set("year", filter.year.toString())
    if (filter?.month) qs.set("month", filter.month.toString())
    return apiFetch<LeaveGrant[]>(`/admin/leave/grants${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },

  async grantLeave(data: { year?: number; month?: number }): Promise<ApiResponse<{ message: string; year: number; month: number }>> {
    return apiFetch<{ message: string; year: number; month: number }>("/admin/leave/grant", {
      method: "POST",
      json: data,
    })
  },

  // Audit Logs API
  async getAuditLogs(filter: AuditLogFilter): Promise<ApiResponse<AuditLogListResponse>> {
    const qs = new URLSearchParams()
    if (filter.adminUserId) qs.set("adminUserId", filter.adminUserId.toString())
    if (filter.entityType) qs.set("entityType", filter.entityType)
    if (filter.entityId) qs.set("entityId", filter.entityId)
    if (filter.actionType) qs.set("actionType", filter.actionType)
    if (filter.from) qs.set("from", filter.from)
    if (filter.to) qs.set("to", filter.to)
    if (filter.limit) qs.set("limit", filter.limit.toString())
    if (filter.offset) qs.set("offset", filter.offset.toString())
    return apiFetch<AuditLogListResponse>(`/admin/audit${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },
}

export const userApi = {
  async getAll(): Promise<ApiResponse<User[]>> {
    const res = await adminApi.getUsers({ limit: 100 })
    return {
      data: res.data?.data || [],
    }
  },
}

export const departmentApi = {
  async getAll(): Promise<ApiResponse<Department[]>> {
    return adminApi.getDepartments()
  },
}

export const leaveApi = {
  async getSummary(filter?: { year?: number; month?: number }): Promise<
    ApiResponse<{
      userId: number
      year: number
      month: number
      expectedUnits: number
      workedUnits: number
      missingUnits: number
      paidUsedUnits: number
      unpaidUnits: number
      isBirthday: boolean
      updatedAt: string
    }>
  > {
    const qs = new URLSearchParams()
    if (filter?.year) qs.set("year", filter.year.toString())
    if (filter?.month) qs.set("month", filter.month.toString())
    return apiFetch(`/me/leave/summary${qs.toString() ? `?${qs}` : ""}`, { method: "GET" })
  },
}

export const noteApi = {
  async getByUser(userId: number): Promise<ApiResponse<Note[]>> {
    // Spec uses getMyNotes, so this is a compatibility shim
    await delay(400)
    const notes = mockNotes.filter((n) => n.userId === userId)
    return { data: notes }
  },
  async create(data: { userId: number; content: string; date: string }): Promise<ApiResponse<Note>> {
    return notesApi.updateMyNote(data.date, data.content, data.userId)
  },
  async update(id: number, data: { content: string; date: string }): Promise<ApiResponse<Note>> {
    // userId is not available here; rely on backend or currentUser in fallback
    return notesApi.updateMyNote(data.date, data.content)
  },
  async delete(id: number): Promise<ApiResponse<void>> {
    await delay(400)
    const index = mockNotes.findIndex((n) => n.id === id)
    if (index !== -1) mockNotes.splice(index, 1)
    return { data: undefined }
  },
}
