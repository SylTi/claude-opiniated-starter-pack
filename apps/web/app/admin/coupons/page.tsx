"use client"

import { useCallback, useEffect, useState } from "react"
import { adminCouponsApi, ApiError } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import type { CouponDTO } from "@saas/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui/table"
import { Button } from "@saas/ui/button"
import { Badge } from "@saas/ui/badge"
import { Input } from "@saas/ui/input"
import { Label } from "@saas/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saas/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@saas/ui/dialog"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function AdminCouponsPage(): React.ReactElement {
  const { locale, t } = useI18n("skeleton")
  const [coupons, setCoupons] = useState<CouponDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<CouponDTO | null>(null)
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    creditAmount: "",
    currency: "usd",
    expiresAt: "",
    isActive: true,
  })

  const fetchCoupons = useCallback(async (): Promise<void> => {
    try {
      const data = await adminCouponsApi.list()
      setCoupons(data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const resetForm = (): void => {
    setFormData({
      code: "",
      description: "",
      creditAmount: "",
      currency: "usd",
      expiresAt: "",
      isActive: true,
    })
    setEditingCoupon(null)
  }

  const openCreateDialog = (): void => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (coupon: CouponDTO): void => {
    if (coupon.redeemedByUserId !== null) {
      toast.error(t("adminCoupons.cannotEditRedeemed"))
      return
    }
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      creditAmount: String(coupon.creditAmount),
      currency: coupon.currency,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split("T")[0] : "",
      isActive: coupon.isActive,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (): Promise<void> => {
    try {
      setActionLoading(-1)
      const payload = {
        code: formData.code,
        description: formData.description || undefined,
        creditAmount: Number(formData.creditAmount),
        currency: formData.currency,
        expiresAt: formData.expiresAt || undefined,
        isActive: formData.isActive,
      }

      if (editingCoupon) {
        await adminCouponsApi.update(editingCoupon.id, payload)
        toast.success(t("adminCoupons.updateSuccess"))
      } else {
        await adminCouponsApi.create(payload)
        toast.success(t("adminCoupons.createSuccess"))
      }

      setIsDialogOpen(false)
      resetForm()
      fetchCoupons()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm(t("adminCoupons.confirmDelete"))) {
      return
    }

    try {
      setActionLoading(id)
      await adminCouponsApi.delete(id)
      toast.success(t("adminCoupons.deleteSuccess"))
      fetchCoupons()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (coupon: CouponDTO): Promise<void> => {
    if (coupon.redeemedByUserId !== null) {
      toast.error(t("adminCoupons.cannotModifyRedeemed"))
      return
    }
    try {
      setActionLoading(coupon.id)
      await adminCouponsApi.update(coupon.id, { isActive: !coupon.isActive })
      toast.success(
        t(coupon.isActive ? "adminCoupons.disabledSuccess" : "adminCoupons.enabledSuccess"),
      )
      fetchCoupons()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return t("adminCoupons.notAvailable")
    return new Date(dateString).toLocaleDateString(locale)
  }

  const formatAmount = (amount: number, currency: string | undefined): string => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount / 100)
  }

  const getCouponStatus = (coupon: CouponDTO): { label: string; variant: "default" | "secondary" | "destructive" } => {
    if (coupon.redeemedByUserId !== null) {
      return { label: t("adminCoupons.statusRedeemed"), variant: "secondary" }
    }
    if (!coupon.isActive) {
      return { label: t("adminCoupons.statusInactive"), variant: "destructive" }
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { label: t("adminCoupons.statusExpired"), variant: "destructive" }
    }
    return { label: t("adminCoupons.statusActive"), variant: "default" }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("adminCoupons.title")}</h1>
          <p className="text-muted-foreground">{t("adminCoupons.subtitle")}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("adminCoupons.addCoupon")}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("adminCoupons.tableCode")}</TableHead>
            <TableHead>{t("adminCoupons.tableCreditAmount")}</TableHead>
            <TableHead>{t("adminCoupons.tableExpires")}</TableHead>
            <TableHead>{t("adminCoupons.tableStatus")}</TableHead>
            <TableHead>{t("adminCoupons.tableRedeemedBy")}</TableHead>
            <TableHead>{t("adminCoupons.tableActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((coupon) => {
            const status = getCouponStatus(coupon)
            return (
              <TableRow key={coupon.id}>
                <TableCell>
                  <div>
                    <span className="font-mono font-semibold">{coupon.code}</span>
                    {coupon.description && (
                      <p className="text-sm text-muted-foreground">{coupon.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formatAmount(coupon.creditAmount, coupon.currency)}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(coupon.expiresAt)}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {coupon.redeemedByUserEmail ? (
                    <div className="text-sm">
                      <p>{coupon.redeemedByUserEmail}</p>
                      <p className="text-muted-foreground">{formatDate(coupon.redeemedAt)}</p>
                    </div>
                  ) : (
                    t("adminCoupons.notAvailable")
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(coupon)}
                      disabled={actionLoading === coupon.id || coupon.redeemedByUserId !== null}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {coupon.redeemedByUserId === null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(coupon)}
                        disabled={actionLoading === coupon.id}
                      >
                        {actionLoading === coupon.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : coupon.isActive ? (
                          t("adminCoupons.disable")
                        ) : (
                          t("adminCoupons.enable")
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(coupon.id)}
                      disabled={actionLoading === coupon.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {coupons.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {t("adminCoupons.noCoupons")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? t("adminCoupons.editCoupon") : t("adminCoupons.createCoupon")}
            </DialogTitle>
            <DialogDescription>
              {editingCoupon
                ? t("adminCoupons.editDescription")
                : t("adminCoupons.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">{t("adminCoupons.fieldCode")}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder={t("adminCoupons.codePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="description">{t("adminCoupons.fieldDescription")}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("adminCoupons.descriptionPlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="creditAmount">{t("adminCoupons.fieldCreditAmount")}</Label>
                <Input
                  id="creditAmount"
                  type="number"
                  value={formData.creditAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, creditAmount: e.target.value })
                  }
                  placeholder={t("adminCoupons.creditAmountPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="currency">{t("adminCoupons.fieldCurrency")}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">{t("common.currency.usd")}</SelectItem>
                    <SelectItem value="eur">{t("common.currency.eur")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="expiresAt">{t("adminCoupons.fieldExpirationDate")}</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t("adminCoupons.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading === -1}>
              {actionLoading === -1 && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCoupon ? t("adminCoupons.update") : t("adminCoupons.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
