"use client"

import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api" // Using adminApi to fetch departments and users
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Plus, Users, User, ArrowRight, MoreHorizontal, LayoutGrid, List } from "lucide-react"
import type { Department, User as UserType } from "@/lib/types"

export default function DepartmentManagementPage() {
  const { t } = useI18n()
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [deptsRes, usersRes] = await Promise.all([adminApi.getDepartments(), adminApi.getUsers({ limit: 100 })])
        if (deptsRes.data) setDepartments(deptsRes.data)
        if (usersRes.data) setUsers(usersRes.data.items || [])
      } catch (err) {
        console.error("Failed to load data:", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.departments.title}</h1>
          <p className="text-muted-foreground">Organize employees into functional units</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-1 rounded-xl">
            <Button
              variant={viewMode === "grid" ? "background" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "background" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button className="rounded-xl h-11 gap-2 shadow-lg shadow-primary/10">
            <Plus className="h-4 w-4" />
            {t.departments.addDepartment}
          </Button>
        </div>
      </div>

      <div className={cn("gap-6", viewMode === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col")}>
        {isLoading
          ? [...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)
          : departments.map((dept) => {
              const memberCount = (users || []).filter((u) => u.departmentId === dept.id).length
              return (
                <Card
                  key={dept.id}
                  className="group border-border/50 bg-card/50 hover:bg-card transition-all overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Building2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight">{dept.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                          <Users className="h-3 w-3" />
                          {memberCount} Members
                        </div>
                      </div>
                    </div>
                    {dept.code && (
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] leading-relaxed">
                        Mã: {dept.code}
                    </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 pb-6 border-t border-border/10 mt-2">
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <User className="h-3 w-3" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase text-muted-foreground font-bold leading-none mb-1">
                            Thành viên
                          </span>
                          <span className="text-xs font-semibold">{memberCount} người</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 pr-0 group-hover:text-primary transition-colors"
                      >
                        Details <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
      </div>
    </div>
  )
}
