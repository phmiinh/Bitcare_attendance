// User roles - removed superadmin, only user and admin
export type UserRole = "user" | "admin"

// User status
export type UserStatus = "active" | "disabled"

// User interface - updated to match API spec
export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  departmentId?: number | null
  departmentName?: string | null
  birthday?: string | null
  paidLeave?: number
  createdAt?: string
}

// Department interface - updated to match API spec
export interface Department {
  id: number
  name: string
  code?: string | null
  headcount?: number
}

// Attendance today - new type for today's attendance
export interface AttendanceToday {
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  dayUnit: 0 | 0.5 | 1

  status: "NOT_CHECKED_IN" | "OPEN" | "CLOSED"
}

// Attendance row - new type for attendance list
export interface AttendanceRow {
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  dayUnit: number

  notePreview: string | null
  status: "OPEN" | "CLOSED" | "MISSING"
  isLeave?: boolean // true if this day is marked as leave
  isUnpaidLeave?: boolean // true if this is unpaid leave
}

// Alias for AttendanceRow (used in some places)
export type AttendanceRecord = AttendanceRow

// Attendance list response
export interface AttendanceListResponse {
  from: string
  to: string
  rows: AttendanceRow[]
}

// User stats - updated to match API spec
export interface StatsMe {
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
    // raw totals to correctly compute avg deltas on FE
    currentTotalWorkedMinutes: number
    currentWorkedDays: number
    prevTotalWorkedMinutes: number
    prevWorkedDays: number

    // legacy deltas
    workedMinutesDelta: number
    dayUnitDelta: number
    workedDaysDelta: number
  }
  series: {
    workDate: string
    workedMinutes: number
    dayUnit: number
    anomalies: {
      total: number
      missingCheckOut: number
      missingCheckIn: number
    }
  }[]
}

// Admin overview stats - new type
export interface AdminOverview {
  from: string
  to: string
  totalUsers: number
  checkedInToday: number
  notCheckedInToday: number
  missingCheckout: number
  trend: {
    workDate: string
    totalWorkedMinutes: number
    totalDayUnit: number
  }[]
  topAnomalies: {
    userId: number
    name: string
    missingCount: number
    departmentName?: string | null
  }[]
}

// Admin today ops
export interface AdminTodayOps {
  usersActive: number
  checkedIn: number
  notCheckedIn: number
  openSessions: number
  missingCheckout: number
  anomalies: number
}

// Admin top issues
export interface AdminTopIssues {
  topLate: {
    userId: number
    name: string
    count: number
    departmentName?: string | null
  }[]
  topEarly: {
    userId: number
    name: string
    count: number
    departmentName?: string | null
  }[]
  topMissing: {
    userId: number
    name: string
    count: number
    departmentName?: string | null
  }[]
}

// Note interface - kept for daily work notes
export interface Note {
  id: number
  userId: number
  date: string
  content: string
  createdAt?: string
  updatedAt?: string
}

// Filter options
export interface DateFilter {
  from?: string
  to?: string
}

export interface UserFilter {
  query?: string
  page?: number
  limit?: number
  departmentId?: number
}

// API response types - updated to match standard response format
export interface ApiResponse<T> {
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

// Auth types - updated to remove token storage (using HttpOnly cookies)
export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  departmentId?: number | null
  departmentName?: string | null
  birthday?: string | null
  paidLeave?: number
}

// Locale type
export type Locale = "vi" | "en"

// Admin Attendance types
export interface AdminAttendanceRow {
  id: number
  userId: number
  userName: string
  departmentName?: string | null
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  workedMinutes: number
  dayUnit: number
  status: "OPEN" | "CLOSED" | "MISSING"
  checkoutReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminAttendanceListResponse {
  from: string
  to: string
  rows: AdminAttendanceRow[]
}

export interface AdminAttendanceFilter {
  from?: string
  to?: string
  userId?: number
  departmentId?: number
  status?: "OPEN" | "CLOSED" | "MISSING"
}

// Work Calendar types
export interface WorkCalendarDay {
  date: string
  isWorkingDay: boolean
  workUnit: number
  note?: string | null
}

export interface WorkCalendarBulkUpdate {
  days: {
    date: string
    isWorkingDay: boolean
    workUnit: number
    note?: string | null
  }[]
}

// Leave Management types
export interface LeaveMonthlySummary {
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
}

export interface LeaveGrant {
  id: number
  grantYear: number
  grantMonth: number
  grantType: string
  createdAt: string
}

// Audit Log types
export interface AuditLog {
  id: number
  adminUserId: number
  actionType: string
  entityType: string
  entityId: string
  beforeJson?: Record<string, any> | null
  afterJson?: Record<string, any> | null
  reason?: string | null
  createdAt: string
}

export interface AuditLogListResponse {
  items: AuditLog[]
  total: number
  limit: number
  offset: number
}

export interface AuditLogFilter {
  adminUserId?: number
  entityType?: string
  entityId?: string
  actionType?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}
