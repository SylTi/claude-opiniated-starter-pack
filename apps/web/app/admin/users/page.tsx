"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useI18n } from "@/contexts/i18n-context"
import { api, ApiError } from "@/lib/api"
import { Button } from "@saas/ui/button"
import { Badge } from "@saas/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@saas/ui/dialog"
import { toast } from "sonner"
import { type AdminUserDTO } from "@saas/shared"

export default function AdminUsersPage(): React.ReactElement {
  const { locale, t } = useI18n("skeleton")
  const router = useRouter()
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUserDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId: number | null;
    email: string;
  }>({
    open: false,
    userId: null,
    email: "",
  })

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const usersResponse = await api.get<AdminUserDTO[]>(
        "/api/v1/admin/users",
      )
      if (usersResponse.data) {
        setUsers(usersResponse.data)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
        if (error.statusCode === 401 || error.statusCode === 403) {
          router.push("/dashboard")
        }
      } else {
        toast.error(t("adminUsers.fetchError"))
      }
    } finally {
      setIsLoading(false)
    }
  }, [router, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleVerifyEmail(userId: number): Promise<void> {
    setActionLoading(userId)
    try {
      await api.post(`/api/v1/admin/users/${userId}/verify-email`)
      toast.success(t("adminUsers.verifyEmailSuccess"))
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminUsers.verifyEmailError"))
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function handleUnverifyEmail(userId: number): Promise<void> {
    setActionLoading(userId)
    try {
      await api.post(`/api/v1/admin/users/${userId}/unverify-email`)
      toast.success(t("adminUsers.unverifyEmailSuccess"))
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminUsers.unverifyEmailError"))
      }
    } finally {
      setActionLoading(null)
    }
  }

  function openDeleteDialog(userId: number, email: string): void {
    setDeleteDialog({ open: true, userId, email })
  }

  function closeDeleteDialog(): void {
    setDeleteDialog({ open: false, userId: null, email: "" })
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteDialog.userId) return

    setActionLoading(deleteDialog.userId)
    try {
      await api.delete(`/api/v1/admin/users/${deleteDialog.userId}`)
      toast.success(t("adminUsers.deleteSuccess"))
      closeDeleteDialog()
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminUsers.deleteError"))
      }
    } finally {
      setActionLoading(null)
    }
  }

  function getTenantTypeBadgeVariant(
    type: string | null,
  ): "default" | "secondary" | "outline" {
    if (type === "team") return "default"
    if (type === "personal") return "secondary"
    return "outline"
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return t("adminUsers.notAvailable")
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("adminUsers.title")}</CardTitle>
          <CardDescription>
            {t("adminUsers.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminUsers.tableId")}</TableHead>
                <TableHead>{t("adminUsers.tableEmail")}</TableHead>
                <TableHead>{t("adminUsers.tableName")}</TableHead>
                <TableHead>{t("adminUsers.tableRole")}</TableHead>
                <TableHead>{t("adminUsers.tableCurrentTenant")}</TableHead>
                <TableHead>{t("adminUsers.tableEmailStatus")}</TableHead>
                <TableHead>{t("adminUsers.tableMfa")}</TableHead>
                <TableHead>{t("adminUsers.tableCreated")}</TableHead>
                <TableHead className="text-right">{t("adminUsers.tableActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t("adminUsers.noUsers")}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-sm">{u.id}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.fullName || t("adminUsers.notAvailable")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.currentTenantName ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{u.currentTenantName}</span>
                          <Badge
                            variant={getTenantTypeBadgeVariant(
                              u.currentTenantType,
                            )}
                            className="w-fit text-xs"
                          >
                            {u.currentTenantType || t("adminUsers.none")}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{t("adminUsers.notAvailable")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.emailVerified ? (
                        <Badge variant="default">
                          {t("adminUsers.verified")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{t("adminUsers.unverified")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.mfaEnabled ? (
                        <Badge variant="default">
                          {t("adminUsers.enabled")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("adminUsers.disabled")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {u.emailVerified ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnverifyEmail(u.id)}
                            disabled={actionLoading === u.id}
                          >
                            {actionLoading === u.id ? t("adminUsers.loading") : t("adminUsers.unverify")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleVerifyEmail(u.id)}
                            disabled={actionLoading === u.id}
                          >
                            {actionLoading === u.id ? t("adminUsers.loading") : t("adminUsers.verify")}
                          </Button>
                        )}
                        {u.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDeleteDialog(u.id, u.email)}
                            disabled={actionLoading === u.id}
                          >
                            {t("adminUsers.delete")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminUsers.deleteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminUsers.deleteDialogDescription", { email: deleteDialog.email })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              {t("adminUsers.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={actionLoading !== null}
            >
              {actionLoading !== null ? t("adminUsers.deleting") : t("adminUsers.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
