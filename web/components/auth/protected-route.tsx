"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { useUiToast } from "@/lib/ui-toast"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: "user" | "admin"
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useUiToast()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
      return
    }

    if (!isLoading && user && requiredRole) {
      // Admin check - only admin can access admin routes
      if (requiredRole === "admin" && user.role !== "admin") {
        toast("error", "accessDenied")
        router.push("/dashboard")
        return
      }

      // User check - only regular users can access user routes (if needed in future)
      if (requiredRole === "user" && user.role === "admin") {
        // Admins can access user routes, so no redirect needed
        // But if you want to restrict admins from user routes, uncomment:
        // router.push("/dashboard/admin")
      }
    }
  }, [user, isLoading, router, requiredRole, pathname, toast])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Don't render children if user doesn't have required role
  if (requiredRole && user.role !== requiredRole) {
    return null
  }

  return <>{children}</>
}
