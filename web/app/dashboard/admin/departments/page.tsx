"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { useI18n } from "@/lib/i18n"
import { adminApi } from "@/lib/api"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Building2, Plus, Users, Eye, Edit, Trash2, ChevronRight, ChevronDown, Search, User } from "lucide-react"
import type { Department, User as UserType } from "@/lib/types"
import { useUiToast } from "@/lib/ui-toast"

interface TreeNode {
  id: number
  name: string
  code?: string | null
  type: "department"
  children: TreeNode[]
  users: UserType[]
  expanded?: boolean
}

export default function DepartmentManagementPage() {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useUiToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false)
  const [isMoveUserDialogOpen, setIsMoveUserDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingDepartment, setIsDeletingDepartment] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserType | null>(null)
  const [movingUser, setMovingUser] = useState<UserType | null>(null)
  const [targetDepartmentId, setTargetDepartmentId] = useState<number | null>(null)
  const [targetDepartmentName, setTargetDepartmentName] = useState<string>("")
  const [formData, setFormData] = useState({ name: "", code: "" })
  const [draggedUser, setDraggedUser] = useState<UserType | null>(null)
  const [deletedUsers, setDeletedUsers] = useState<UserType[]>([])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [deptsRes, usersRes] = await Promise.all([
        adminApi.getDepartments(),
        adminApi.getUsers({ limit: 1000 }),
      ])
      if (deptsRes.data) setDepartments(deptsRes.data)
      if (usersRes.data) {
        const allUsers = usersRes.data.items || []
        setUsers(allUsers)
        // Filter deleted users (users without departmentId)
        setDeletedUsers(allUsers.filter((u) => !u.departmentId))
      }
    } catch (err) {
      console.error("Failed to load data:", err)
      toast("error", "common.error")
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Remove toast from dependencies to prevent infinite loop

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Build tree structure - memoized for performance
  const treeDataMemo = useMemo(() => {
    const buildTree = (): TreeNode[] => {
      const root: TreeNode = {
        id: 0,
        name: "Bitcare JSC",
        type: "department",
        children: [],
        users: [],
        expanded: true,
      }

      departments.forEach((dept) => {
        const deptUsers = users.filter((u) => u.departmentId === dept.id)
        const node: TreeNode = {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          type: "department",
          children: [],
          users: deptUsers,
          expanded: false,
        }
        root.children.push(node)
      })

      return [root]
    }

    if (departments.length > 0 || users.length > 0) {
      return buildTree()
    }
    return []
  }, [departments, users])

  // Update treeData only when treeDataMemo changes, preserving expanded state
  useEffect(() => {
    if (treeDataMemo.length > 0) {
      setTreeData((prev) => {
        // Only update if structure actually changed
        const prevRoot = prev.find((n) => n.id === 0)
        const newRoot = treeDataMemo.find((n) => n.id === 0)
        
        if (!prevRoot || !newRoot) {
          // First load or structure changed significantly
          const preserveExpanded = (newNode: TreeNode, oldNodes: TreeNode[]): TreeNode => {
            const oldNode = oldNodes.find((n) => n.id === newNode.id)
            if (oldNode) {
              return { ...newNode, expanded: oldNode.expanded }
            }
            if (newNode.children.length > 0) {
              return {
                ...newNode,
                children: newNode.children.map((child) => preserveExpanded(child, oldNodes.flatMap((n) => n.children))),
              }
            }
            return newNode
          }
          return treeDataMemo.map((node) => preserveExpanded(node, prev))
        }
        
        // Check if departments structure changed (added/removed)
        const prevDeptIds = new Set(prevRoot.children.map((c) => c.id))
        const newDeptIds = new Set(newRoot.children.map((c) => c.id))
        const deptStructureChanged = prevRoot.children.length !== newRoot.children.length ||
          prevRoot.children.some((c) => !newDeptIds.has(c.id)) ||
          newRoot.children.some((c) => !prevDeptIds.has(c.id))
        
        // Check if department names or codes changed
        const deptDataChanged = prevRoot.children.some((prevChild) => {
          const newChild = newRoot.children.find((c) => c.id === prevChild.id)
          if (!newChild) return false
          return prevChild.name !== newChild.name || prevChild.code !== newChild.code
        })
        
        if (deptStructureChanged || deptDataChanged) {
          // Structure or data changed, preserve expanded state but update data
          const preserveExpanded = (newNode: TreeNode, oldNodes: TreeNode[]): TreeNode => {
            const oldNode = oldNodes.find((n) => n.id === newNode.id)
            if (oldNode) {
              return { ...newNode, expanded: oldNode.expanded }
            }
            if (newNode.children.length > 0) {
              return {
                ...newNode,
                children: newNode.children.map((child) => preserveExpanded(child, oldNodes.flatMap((n) => n.children))),
              }
            }
            return newNode
          }
          return treeDataMemo.map((node) => preserveExpanded(node, prev))
        }
        
        // Only users changed, update users but keep everything else
        return prev.map((node) => {
          if (node.id === 0) {
            const newRootNode = treeDataMemo.find((n) => n.id === 0)
            if (newRootNode) {
              return {
                ...node,
                children: node.children.map((child) => {
                  const newChild = newRootNode.children.find((c) => c.id === child.id)
                  return newChild ? { ...child, users: newChild.users } : child
                }),
              }
            }
          }
          return node
        })
      })
    } else if (treeData.length > 0) {
      setTreeData([])
    }
  }, [treeDataMemo]) // Only depend on treeDataMemo

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast("error", "departments.nameRequired")
      return
    }
    if (formData.name.trim().length < 2) {
      toast("error", "departments.nameMinLength")
      return
    }

    try {
      const res = await adminApi.createDepartment({
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
      })
      if (res.data) {
        toast("success", "departments.createSuccess")
        setIsCreateDialogOpen(false)
        setFormData({ name: "", code: "" })
        loadData()
      } else {
        toast("error", "departments.createError")
      }
    } catch (err) {
      console.error("Failed to create department:", err)
      toast("error", "departments.createError")
    }
  }

  const handleEdit = async () => {
    if (!editingDepartment) return
    if (!formData.name.trim()) {
      toast("error", "departments.nameRequired")
      return
    }
    if (formData.name.trim().length < 2) {
      toast("error", "departments.nameMinLength")
      return
    }

    try {
      const res = await adminApi.updateDepartment(editingDepartment.id, {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
      })
      if (res.data) {
        toast("success", "departments.updateSuccess")
        setIsEditDialogOpen(false)
        setEditingDepartment(null)
        setFormData({ name: "", code: "" })
        loadData()
      } else {
        toast("error", "departments.updateError")
      }
    } catch (err) {
      console.error("Failed to update department:", err)
      toast("error", "departments.updateError")
    }
  }

  const handleDelete = async () => {
    if (!deletingDepartment) return
    setIsDeletingDepartment(true)
    try {
      const res = await adminApi.deleteDepartment(deletingDepartment.id)
      if (res.data !== undefined) {
        toast("success", "departments.deleteSuccess")
        setIsDeleteDialogOpen(false)
        setDeletingDepartment(null)
        loadData()
      } else {
        toast("error", "departments.deleteError")
      }
    } catch (err) {
      console.error("Failed to delete department:", err)
      toast("error", "departments.deleteError")
    } finally {
      setIsDeletingDepartment(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setIsDeleting(true)
    try {
      const res = await adminApi.deleteUser(deletingUser.id)
      if (res.data !== undefined) {
        toast("success", "users.detail.deleteSuccess")
        setIsDeleteUserDialogOpen(false)
        setDeletingUser(null)
        loadData()
      } else {
        toast("error", "users.detail.deleteError")
      }
    } catch (err) {
      console.error("Failed to delete user:", err)
      toast("error", "users.detail.deleteError")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMoveUserConfirm = useCallback(async () => {
    if (!movingUser || targetDepartmentId === undefined) return

    try {
      // Nếu kéo sang panel "Nhân viên đã xóa" (targetDepartmentId === null)
      // thì gửi departmentId = 0 để BE hiểu là bỏ khỏi phòng ban
      const departmentIdForApi =
        targetDepartmentId === null ? 0 : targetDepartmentId

      const res = await adminApi.updateUser(movingUser.id, {
        departmentId: departmentIdForApi,
      })

      if (res.error) {
        console.error("API Error (move user):", res.error)
        toast("error", "departments.moveUserError")
      } else if (res.data) {
        toast("success", "departments.moveUserSuccess")
        setIsMoveUserDialogOpen(false)
        setMovingUser(null)
        setTargetDepartmentId(null)
        setTargetDepartmentName("")
        loadData()
      } else {
        toast("error", "departments.moveUserError")
      }
    } catch (err) {
      console.error("Failed to move user:", err)
      toast("error", "departments.moveUserError")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movingUser, targetDepartmentId])

  const toggleExpand = useCallback((nodeId: number) => {
    setTreeData((prev) => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, expanded: !node.expanded }
          }
          if (node.children.length > 0) {
            return { ...node, children: updateNode(node.children) }
          }
          return node
        })
      }
      return updateNode(prev)
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetDepartmentId: number | null) => {
    e.preventDefault()
    if (draggedUser) {
      // Find department name
      const dept = departments.find((d) => d.id === targetDepartmentId)
      const deptName = dept ? dept.name : (targetDepartmentId === null ? t.departments.deletedUsers : "Bitcare JSC")
      
      setMovingUser(draggedUser)
      setTargetDepartmentId(targetDepartmentId)
      setTargetDepartmentName(deptName)
      setIsMoveUserDialogOpen(true)
      setDraggedUser(null)
    }
  }, [draggedUser, departments, t])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add("bg-muted/50")
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-muted/50")
  }, [])

  const renderTreeNode = useCallback((node: TreeNode, level: number = 0): ReactNode => {
    const filtered = searchQuery
      ? node.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true

    if (!filtered && node.children.length === 0 && node.users.length === 0) {
      return null
    }

    const hasChildren = node.children.length > 0 || node.users.length > 0
    const isExpanded = node.expanded ?? false
    const isRoot = node.id === 0

    return (
      <div key={node.id} className={cn("select-none", !isRoot && "ml-6")}>
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group",
            selectedDepartment === node.id && "bg-muted"
          )}
          style={{ paddingLeft: `${level * 1.5}rem` }}
          onDragOver={!isRoot ? handleDragOver : undefined}
          onDragLeave={!isRoot ? handleDragLeave : undefined}
          onDrop={!isRoot ? (e) => {
            e.preventDefault()
            e.currentTarget.classList.remove("bg-muted/50")
            handleDrop(e, node.id)
          } : undefined}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-medium">{node.name}</span>
          {!isRoot && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setSelectedDepartment(node.id)
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setEditingDepartment({ id: node.id, name: node.name, code: node.code || undefined })
                  setFormData({ name: node.name, code: node.code || "" })
                  setIsEditDialogOpen(true)
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => {
                  setDeletingDepartment({ id: node.id, name: node.name, code: node.code || undefined })
                  setIsDeleteDialogOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {isExpanded && (
          <div className="ml-6">
            {node.users.map((user) => (
              <div
                key={user.id}
                draggable
                onDragStart={() => setDraggedUser(user)}
                onDragEnd={() => setDraggedUser(null)}
                className="flex items-center gap-2 p-2 ml-6 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{user.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      router.push(`/dashboard/admin/users/${user.id}`)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      setDeletingUser(user)
                      setIsDeleteUserDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }, [searchQuery, selectedDepartment, router, toggleExpand, handleDragOver, handleDragLeave, handleDrop])

  const selectedDeptUsers = useMemo(() => {
    if (!selectedDepartment) return []
    return users.filter((u) => u.departmentId === selectedDepartment)
  }, [selectedDepartment, users])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.departments.title}</h1>
          <p className="text-muted-foreground">{t.departments.subtitle}</p>
        </div>
        <Button
          className="rounded-xl h-11 gap-2 shadow-lg shadow-primary/10"
          onClick={() => {
            setFormData({ name: "", code: "" })
            setIsCreateDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {t.departments.addDepartment}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Organizational Structure */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t.departments.organizationalStructure}</h3>
            </div>
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.departments.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-1">
                {treeData.map((node) => renderTreeNode(node))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Selected Department Users or Deleted Users */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">
              {selectedDepartment
                ? departments.find((d) => d.id === selectedDepartment)?.name || t.departments.viewDetails
                : `${t.departments.deletedUsers} (${deletedUsers.length})`}
            </h3>
            {!selectedDepartment && (
              <p className="text-sm text-muted-foreground mt-1">
                {t.departments.deletedUsersDescription}
              </p>
            )}
          </CardHeader>
          <CardContent
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove("bg-muted/50")
              handleDrop(e, selectedDepartment)
            }}
            className="min-h-[400px]"
          >
            {selectedDepartment ? (
              selectedDeptUsers.length > 0 ? (
                <div className="space-y-2">
                  {selectedDeptUsers.map((user) => (
                    <div
                      key={user.id}
                      draggable
                      onDragStart={() => setDraggedUser(user)}
                      onDragEnd={() => setDraggedUser(null)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{user.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            router.push(`/dashboard/admin/users/${user.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            setDeletingUser(user)
                            setIsDeleteUserDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="h-12 w-12 mb-2 opacity-50" />
                  <p>{t.departments.noUsers}</p>
                </div>
              )
            ) : (
              deletedUsers.length > 0 ? (
                <div className="space-y-2">
                  {deletedUsers.map((user) => (
                    <div
                      key={user.id}
                      draggable
                      onDragStart={() => setDraggedUser(user)}
                      onDragEnd={() => setDraggedUser(null)}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{user.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            router.push(`/dashboard/admin/users/${user.id}`)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            setDeletingUser(user)
                            setIsDeleteUserDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Trash2 className="h-12 w-12 mb-2 opacity-50" />
                  <p>{t.departments.noData}</p>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Department Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.departments.addDepartment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t.departments.departmentName} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.departments.departmentName}
              />
            </div>
            <div>
              <Label htmlFor="code">{t.departments.departmentCode}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t.departments.departmentCode}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleCreate}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.departments.editDepartment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">{t.departments.departmentName} *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.departments.departmentName}
              />
            </div>
            <div>
              <Label htmlFor="edit-code">{t.departments.departmentCode}</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t.departments.departmentCode}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleEdit}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Department Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.departments.deleteDepartment}</AlertDialogTitle>
            <AlertDialogDescription>{t.departments.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingDepartment} className="rounded-xl">
              {t.common.cancel}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeletingDepartment}
              className="rounded-xl"
            >
              {isDeletingDepartment ? t.common.loading : t.common.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Dialog */}
      <AlertDialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.departments.deleteUser}</AlertDialogTitle>
            <AlertDialogDescription>{t.departments.deleteUserConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
              {t.common.cancel}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="rounded-xl"
            >
              {isDeleting ? t.common.loading : t.common.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move User Dialog */}
      <AlertDialog open={isMoveUserDialogOpen} onOpenChange={setIsMoveUserDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.departments.moveUserConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {movingUser && targetDepartmentName
                ? t.departments.moveUserConfirmMessage
                    .replace("{userName}", movingUser.name)
                    .replace("{departmentName}", targetDepartmentName)
                : t.departments.moveUserConfirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsMoveUserDialogOpen(false)
                setMovingUser(null)
                setTargetDepartmentId(null)
                setTargetDepartmentName("")
              }}
              className="rounded-xl"
            >
              {t.common.cancel}
            </AlertDialogCancel>
            <Button
              onClick={handleMoveUserConfirm}
              className="rounded-xl"
            >
              {t.common.save}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
