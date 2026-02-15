"use client"

import { useCallback, useEffect, useState } from "react"
import { adminDiscountCodesApi, ApiError } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import type { DiscountCodeDTO } from "@saas/shared"
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

export default function AdminDiscountCodesPage(): React.ReactElement {
  const { locale, t } = useI18n("skeleton")
  const [discountCodes, setDiscountCodes] = useState<DiscountCodeDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<DiscountCodeDTO | null>(null)
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    currency: "usd",
    minAmount: "",
    maxUses: "",
    maxUsesPerTenant: "",
    expiresAt: "",
    isActive: true,
  })

  const fetchDiscountCodes = useCallback(async (): Promise<void> => {
    try {
      const data = await adminDiscountCodesApi.list()
      setDiscountCodes(data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDiscountCodes()
  }, [fetchDiscountCodes])

  const resetForm = (): void => {
    setFormData({
      code: "",
      description: "",
      discountType: "percent",
      discountValue: "",
      currency: "usd",
      minAmount: "",
      maxUses: "",
      maxUsesPerTenant: "",
      expiresAt: "",
      isActive: true,
    })
    setEditingCode(null)
  }

  const openCreateDialog = (): void => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (code: DiscountCodeDTO): void => {
    setEditingCode(code)
    setFormData({
      code: code.code,
      description: code.description || "",
      discountType: code.discountType,
      discountValue: String(code.discountValue),
      currency: code.currency || "usd",
      minAmount: code.minAmount ? String(code.minAmount) : "",
      maxUses: code.maxUses ? String(code.maxUses) : "",
      maxUsesPerTenant: code.maxUsesPerTenant
        ? String(code.maxUsesPerTenant)
        : "",
      expiresAt: code.expiresAt ? code.expiresAt.split("T")[0] : "",
      isActive: code.isActive,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (): Promise<void> => {
    try {
      setActionLoading(-1)
      const payload = {
        code: formData.code,
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        currency:
          formData.discountType === "fixed" ? formData.currency : undefined,
        minAmount: formData.minAmount ? Number(formData.minAmount) : undefined,
        maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
        maxUsesPerTenant: formData.maxUsesPerTenant
          ? Number(formData.maxUsesPerTenant)
          : undefined,
        expiresAt: formData.expiresAt || undefined,
        isActive: formData.isActive,
      }

      if (editingCode) {
        await adminDiscountCodesApi.update(editingCode.id, payload)
        toast.success(t("adminDiscountCodes.updateSuccess"))
      } else {
        await adminDiscountCodesApi.create(payload)
        toast.success(t("adminDiscountCodes.createSuccess"))
      }

      setIsDialogOpen(false)
      resetForm()
      fetchDiscountCodes()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm(t("adminDiscountCodes.confirmDelete"))) {
      return
    }

    try {
      setActionLoading(id)
      await adminDiscountCodesApi.delete(id)
      toast.success(t("adminDiscountCodes.deleteSuccess"))
      fetchDiscountCodes()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async (code: DiscountCodeDTO): Promise<void> => {
    try {
      setActionLoading(code.id)
      await adminDiscountCodesApi.update(code.id, { isActive: !code.isActive })
      toast.success(
        t(code.isActive ? "adminDiscountCodes.disabledSuccess" : "adminDiscountCodes.enabledSuccess"),
      )
      fetchDiscountCodes()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return t("adminDiscountCodes.notAvailable")
    return new Date(dateString).toLocaleDateString(locale)
  }

  const formatDiscount = (code: DiscountCodeDTO): string => {
    if (code.discountType === "percent") {
      return `${code.discountValue}%`
    }
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: (code.currency || "usd").toUpperCase(),
    }).format(code.discountValue / 100)
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
          <h1 className="text-2xl font-bold text-foreground">{t("adminDiscountCodes.title")}</h1>
          <p className="text-muted-foreground">
            {t("adminDiscountCodes.subtitle")}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t("adminDiscountCodes.addDiscountCode")}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("adminDiscountCodes.tableCode")}</TableHead>
            <TableHead>{t("adminDiscountCodes.tableDiscount")}</TableHead>
            <TableHead>{t("adminDiscountCodes.tableUsage")}</TableHead>
            <TableHead>{t("adminDiscountCodes.tableExpires")}</TableHead>
            <TableHead>{t("adminDiscountCodes.tableStatus")}</TableHead>
            <TableHead>{t("adminDiscountCodes.tableActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discountCodes.map((code) => (
            <TableRow key={code.id}>
              <TableCell>
                <div>
                  <span className="font-mono font-semibold">{code.code}</span>
                  {code.description && (
                    <p className="text-sm text-muted-foreground">{code.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatDiscount(code)}</Badge>
              </TableCell>
              <TableCell>
                {code.timesUsed}
                {code.maxUses !== null && ` / ${code.maxUses}`}
              </TableCell>
              <TableCell>{formatDate(code.expiresAt)}</TableCell>
              <TableCell>
                <Badge variant={code.isActive ? "default" : "secondary"}>
                  {code.isActive ? t("adminDiscountCodes.active") : t("adminDiscountCodes.inactive")}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(code)}
                    disabled={actionLoading === code.id}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(code)}
                    disabled={actionLoading === code.id}
                  >
                    {actionLoading === code.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : code.isActive ? (
                      t("adminDiscountCodes.disable")
                    ) : (
                      t("adminDiscountCodes.enable")
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(code.id)}
                    disabled={actionLoading === code.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {discountCodes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {t("adminDiscountCodes.noDiscountCodes")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? t("adminDiscountCodes.editDiscountCode") : t("adminDiscountCodes.createDiscountCode")}
            </DialogTitle>
            <DialogDescription>
              {editingCode
                ? t("adminDiscountCodes.editDescription")
                : t("adminDiscountCodes.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">{t("adminDiscountCodes.fieldCode")}</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder={t("adminDiscountCodes.codePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="description">{t("adminDiscountCodes.fieldDescription")}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("adminDiscountCodes.descriptionPlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discountType">{t("adminDiscountCodes.fieldType")}</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(v: "percent" | "fixed") =>
                    setFormData({ ...formData, discountType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">{t("adminDiscountCodes.typePercentage")}</SelectItem>
                    <SelectItem value="fixed">{t("adminDiscountCodes.typeFixedAmount")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discountValue">
                  {formData.discountType === "percent"
                    ? t("adminDiscountCodes.fieldPercentage")
                    : t("adminDiscountCodes.fieldAmountCents")}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, discountValue: e.target.value })
                  }
                  placeholder={
                    formData.discountType === "percent"
                      ? t("adminDiscountCodes.percentagePlaceholder")
                      : t("adminDiscountCodes.amountPlaceholder")
                  }
                />
              </div>
            </div>
            {formData.discountType === "fixed" && (
              <div>
                <Label htmlFor="currency">{t("adminDiscountCodes.fieldCurrency")}</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) =>
                    setFormData({ ...formData, currency: v })
                  }
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
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxUses">{t("adminDiscountCodes.fieldMaxUsesTotal")}</Label>
                <Input
                  id="maxUses"
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                  placeholder={t("adminDiscountCodes.unlimited")}
                />
              </div>
              <div>
                <Label htmlFor="maxUsesPerTenant">{t("adminDiscountCodes.fieldMaxUsesPerTenant")}</Label>
                <Input
                  id="maxUsesPerTenant"
                  type="number"
                  value={formData.maxUsesPerTenant}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxUsesPerTenant: e.target.value,
                    })
                  }
                  placeholder={t("adminDiscountCodes.unlimited")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="expiresAt">{t("adminDiscountCodes.fieldExpirationDate")}</Label>
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
              {t("adminDiscountCodes.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading === -1}>
              {actionLoading === -1 && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingCode ? t("adminDiscountCodes.update") : t("adminDiscountCodes.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
