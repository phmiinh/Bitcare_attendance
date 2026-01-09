"use client"
import { useEffect, useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n"
import { ThemeToggle } from "@/components/theme-toggle"
import { adminApi } from "@/lib/api"

export function Topbar() {
  const pathname = usePathname()
  const { t, language, setLanguage } = useI18n()
  const [userName, setUserName] = useState<string | null>(null)

  const segments = pathname.split("/").filter(Boolean)

  // Check if we're on user detail page: /dashboard/admin/users/[id]
  const isUserDetailPage = segments.length === 4 && segments[0] === "dashboard" && segments[1] === "admin" && segments[2] === "users"
  const userId = isUserDetailPage ? segments[3] : null

  // Fetch user name if on user detail page
  useEffect(() => {
    if (isUserDetailPage && userId) {
      const fetchUserName = async () => {
        try {
          const userIdNum = parseInt(userId)
          if (!isNaN(userIdNum)) {
            const res = await adminApi.getUsers({})
            if (res.data?.items) {
              const user = res.data.items.find((u) => u.id === userIdNum)
              if (user) {
                setUserName(user.name)
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch user name:", err)
        }
      }
      fetchUserName()
    } else {
      setUserName(null)
    }
  }, [isUserDetailPage, userId])

  // Map segment names to translation keys
  const getSegmentLabel = (segment: string): string => {
    const segmentMap: Record<string, keyof typeof t.nav> = {
      dashboard: "dashboard",
      timesheet: "timesheet",
      notes: "notes",
      admin: "adminDashboard",
      users: "users",
      departments: "departments",
    }
    return segmentMap[segment] ? t.nav[segmentMap[segment]] : segment.charAt(0).toUpperCase() + segment.slice(1)
  }

  // For user detail page, show "Thông tin của + tên người dùng"
  const getCurrentPageLabel = (): string => {
    if (isUserDetailPage && userName) {
      return `${t.nav.userInfo} ${userName}`
    }
    const currentPage = segments.length > 1 ? segments[segments.length - 1] : segments[0]
    return getSegmentLabel(currentPage)
  }

  const currentPageLabel = getCurrentPageLabel()

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-2 border-b border-border/50 bg-background/50 backdrop-blur-md px-4 sticky top-0 z-20">
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                href="/dashboard"
                className="font-medium hover:text-foreground transition-colors"
              >
                {t.nav.homepage}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {currentPageLabel && currentPageLabel !== t.nav.homepage && (
              <>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium">
                    {currentPageLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {/* Theme toggle và Language toggle - giống như ở form login */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <div className="flex overflow-hidden rounded-full border border-border bg-background/60 shadow-sm">
          <button
            type="button"
            onClick={() => setLanguage("vi")}
            className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
              language === "vi" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            VI
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-2 py-1 text-[11px] font-semibold transition-colors ${
              language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  )
}
