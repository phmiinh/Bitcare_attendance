import type React from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Topbar } from "@/components/layout/topbar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Topbar />
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 bg-muted/20">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
