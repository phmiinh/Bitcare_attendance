"use client"
import {
  LayoutDashboard,
  CalendarDays,
  StickyNote,
  Users,
  Building2,
  Settings,
  LogOut,
  ChevronRight,
  Clock,
  Calendar,
  FileText,
  History,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { useRouter, usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useUiToast } from "@/lib/ui-toast"

export function AppSidebar() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const toast = useUiToast()
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    {
      title: t.nav.dashboard,
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: t.nav.timesheet,
      url: "/dashboard/timesheet",
      icon: CalendarDays,
    },
  ]

  const adminItems = [
    {
      title: t.nav.adminDashboard,
      url: "/dashboard/admin",
      icon: LayoutDashboard,
      roles: ["admin", "superadmin"],
    },
    {
      title: t.nav.adminAttendance,
      url: "/dashboard/admin/attendance",
      icon: Clock,
      roles: ["admin", "superadmin"],
    },
    {
      title: t.nav.adminWorkCalendar,
      url: "/dashboard/admin/work-calendar",
      icon: Calendar,
      roles: ["admin", "superadmin"],
    },
    {
      title: t.nav.adminLeave,
      url: "/dashboard/admin/leave",
      icon: FileText,
      roles: ["admin", "superadmin"],
    },
    {
      title: t.nav.users,
      url: "/dashboard/admin/users",
      icon: Users,
      roles: ["admin", "superadmin"],
    },
    {
      title: t.nav.departments,
      url: "/dashboard/admin/departments",
      icon: Building2,
      roles: ["admin", "superadmin"],
    },
    {
      title: t.nav.adminAudit,
      url: "/dashboard/admin/audit",
      icon: History,
      roles: ["admin", "superadmin"],
    },
  ]

  const filteredAdminItems = adminItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)))

  const handleLogout = () => {
    logout()
    toast("success", "logoutSuccess")
    router.push("/login")
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="h-16 flex items-center justify-center group-data-[collapsible=icon]:px-2 px-4">
        <div className="flex items-center gap-2 overflow-hidden w-full group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9">
            <img
              src={resolvedTheme === "dark" ? "/icon-dark.svg" : resolvedTheme === "light" ? "/icon-light.svg" : "/icon.svg"}
              alt="Logo"
              className="h-8 w-8 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7"
              onError={(e) => {
                // Fallback nếu file không tồn tại
                const target = e.target as HTMLImageElement
                target.src = "/icon.svg"
              }}
            />
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-lg tracking-tight">{t.common.appName}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">BITCARE</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 group-data-[collapsible=icon]:px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
            {t.nav.attendanceManagement}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname === item.url}
                    onClick={() => router.push(item.url)}
                    tooltip={item.title}
                    className={cn(
                      "h-10 transition-colors",
                      pathname === item.url ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredAdminItems.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
              {t.nav.administrator}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={pathname === item.url}
                      onClick={() => router.push(item.url)}
                      tooltip={item.title}
                      className={cn(
                        "h-10 transition-colors",
                        pathname === item.url ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex flex-col gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton className="h-12 w-full justify-start gap-3 rounded-xl hover:bg-accent/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:w-auto">
                <Avatar className="h-8 w-8 rounded-lg group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10">
                  <AvatarImage 
                    src={resolvedTheme === "dark" ? "/icon-dark.svg" : resolvedTheme === "light" ? "/icon-light.svg" : "/icon.svg"}
                    alt={user?.name} 
                  />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                    {user?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start leading-none group-data-[collapsible=icon]:hidden">
                  <span className="text-sm font-semibold truncate w-24 text-left">{user?.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">{user?.role}</span>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56 rounded-xl p-2" sideOffset={12}>
              <DropdownMenuLabel className="font-normal p-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg py-2" onClick={() => router.push("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>{t.nav.settings}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-lg py-2 text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t.nav.logout}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
