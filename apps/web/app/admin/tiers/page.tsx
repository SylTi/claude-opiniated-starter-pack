"use client"

import { useCallback, useEffect, useState } from "react"
import { adminBillingApi, ApiError } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import type { SubscriptionTierDTO } from "@saas/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui/card"
import { Button } from "@saas/ui/button"
import { Badge } from "@saas/ui/badge"
import { Input } from "@saas/ui/input"
import { Label } from "@saas/ui/label"
import { Textarea } from "@saas/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@saas/ui/dialog"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

type TierFormState = {
  slug: string;
  name: string;
  level: string;
  maxTeamMembers: string;
  priceMonthly: string;
  yearlyDiscountPercent: string;
  quotaMaxPendingInvitations: string;
  quotaMaxAuthTokensPerTenant: string;
  quotaMaxAuthTokensPerUser: string;
  features: string;
  isActive: boolean;
};

const defaultFormState: TierFormState = {
  slug: "",
  name: "",
  level: "0",
  maxTeamMembers: "",
  priceMonthly: "",
  yearlyDiscountPercent: "",
  quotaMaxPendingInvitations: "",
  quotaMaxAuthTokensPerTenant: "",
  quotaMaxAuthTokensPerUser: "",
  features: "",
  isActive: true,
}

function readQuotaValue(source: Record<string, unknown>, camelKey: string, snakeKey: string): string {
  const raw = source[camelKey] ?? source[snakeKey]
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return String(raw)
  }
  return ""
}

function parseQuotaInput(
  value: string,
  errorMessage: string,
): { hasValue: false } | { hasValue: true; value: number } | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return { hasValue: false }
  }
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 1) {
    toast.error(errorMessage)
    return null
  }
  return { hasValue: true, value: parsed }
}

export default function AdminTiersPage(): React.ReactElement {
  const { t } = useI18n("skeleton")
  const [tiers, setTiers] = useState<SubscriptionTierDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<SubscriptionTierDTO | null>(null)
  const [formData, setFormData] = useState<TierFormState>(defaultFormState)

  const fetchTiers = useCallback(async (): Promise<void> => {
    try {
      const data = await adminBillingApi.listTiers()
      setTiers(data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTiers.fetchError"))
      }
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchTiers()
  }, [fetchTiers])

  const resetForm = (): void => {
    setFormData(defaultFormState)
    setEditingTier(null)
  }

  const openCreateDialog = (): void => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEditDialog = (tier: SubscriptionTierDTO): void => {
    const quotaSource =
      tier.features &&
      typeof tier.features === "object" &&
      !Array.isArray(tier.features) &&
      tier.features.quotas &&
      typeof tier.features.quotas === "object" &&
      !Array.isArray(tier.features.quotas)
        ? (tier.features.quotas as Record<string, unknown>)
        : {}

    setEditingTier(tier)
    setFormData({
      slug: tier.slug,
      name: tier.name,
      level: String(tier.level),
      maxTeamMembers: tier.maxTeamMembers?.toString() ?? "",
      priceMonthly: tier.priceMonthly?.toString() ?? "",
      yearlyDiscountPercent: tier.yearlyDiscountPercent?.toString() ?? "",
      quotaMaxPendingInvitations: readQuotaValue(
        quotaSource,
        "maxPendingInvitations",
        "max_pending_invitations",
      ),
      quotaMaxAuthTokensPerTenant: readQuotaValue(
        quotaSource,
        "maxAuthTokensPerTenant",
        "max_auth_tokens_per_tenant",
      ),
      quotaMaxAuthTokensPerUser: readQuotaValue(
        quotaSource,
        "maxAuthTokensPerUser",
        "max_auth_tokens_per_user",
      ),
      features: tier.features ? JSON.stringify(tier.features, null, 2) : "",
      isActive: tier.isActive,
    })
    setIsDialogOpen(true)
  }

  const buildPayload = (allowNullFeatures: boolean): {
    slug?: string;
    name?: string;
    level?: number;
    maxTeamMembers?: number | null;
    priceMonthly?: number | null;
    yearlyDiscountPercent?: number | null;
    features?: Record<string, unknown> | null;
    isActive?: boolean;
  } | null => {
    let features: Record<string, unknown> | null | undefined
    if (!formData.features.trim()) {
      features = allowNullFeatures ? null : undefined
    } else {
      try {
        const parsed = JSON.parse(formData.features)
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          toast.error(t("adminTiers.featuresMustBeJsonObject"))
          return null
        }
        features = parsed as Record<string, unknown>
      } catch {
        toast.error(t("adminTiers.featuresMustBeValidJson"))
        return null
      }
    }

    const pendingInvitesInput = parseQuotaInput(
      formData.quotaMaxPendingInvitations,
      t("adminTiers.maxPendingInvitationsValidation"),
    )
    if (!pendingInvitesInput) {
      return null
    }

    const perTenantTokensInput = parseQuotaInput(
      formData.quotaMaxAuthTokensPerTenant,
      t("adminTiers.maxTokensPerTenantValidation"),
    )
    if (!perTenantTokensInput) {
      return null
    }

    const perUserTokensInput = parseQuotaInput(
      formData.quotaMaxAuthTokensPerUser,
      t("adminTiers.maxTokensPerUserValidation"),
    )
    if (!perUserTokensInput) {
      return null
    }

    const hasAnyQuotaDefault =
      pendingInvitesInput.hasValue || perTenantTokensInput.hasValue || perUserTokensInput.hasValue

    const nextFeatures =
      features === undefined || features === null ? {} : { ...features }
    const currentQuotasRaw = nextFeatures.quotas
    const currentQuotas =
      currentQuotasRaw && typeof currentQuotasRaw === "object" && !Array.isArray(currentQuotasRaw)
        ? { ...(currentQuotasRaw as Record<string, unknown>) }
        : {}

    delete currentQuotas.maxPendingInvitations
    delete currentQuotas.max_pending_invitations
    delete currentQuotas.maxAuthTokensPerTenant
    delete currentQuotas.max_auth_tokens_per_tenant
    delete currentQuotas.maxAuthTokensPerUser
    delete currentQuotas.max_auth_tokens_per_user

    if (pendingInvitesInput.hasValue) {
      currentQuotas.maxPendingInvitations = pendingInvitesInput.value
    }
    if (perTenantTokensInput.hasValue) {
      currentQuotas.maxAuthTokensPerTenant = perTenantTokensInput.value
    }
    if (perUserTokensInput.hasValue) {
      currentQuotas.maxAuthTokensPerUser = perUserTokensInput.value
    }

    if (Object.keys(currentQuotas).length > 0) {
      nextFeatures.quotas = currentQuotas
    } else {
      delete nextFeatures.quotas
    }

    if (hasAnyQuotaDefault || Object.keys(nextFeatures).length > 0) {
      features = nextFeatures
    } else if (allowNullFeatures) {
      features = null
    } else {
      features = undefined
    }

    return {
      slug: formData.slug.trim() || undefined,
      name: formData.name.trim() || undefined,
      level: Number(formData.level),
      maxTeamMembers: formData.maxTeamMembers
        ? Number(formData.maxTeamMembers)
        : null,
      priceMonthly: formData.priceMonthly ? Number(formData.priceMonthly) : null,
      yearlyDiscountPercent: formData.yearlyDiscountPercent
        ? Number(formData.yearlyDiscountPercent)
        : null,
      features,
      isActive: formData.isActive,
    }
  }

  const handleSubmit = async (): Promise<void> => {
    const payload = buildPayload(!!editingTier)
    if (!payload) {
      return
    }

    try {
      setActionLoading(true)
      if (editingTier) {
        await adminBillingApi.updateTier(editingTier.id, payload)
        toast.success(t("adminTiers.updateSuccess"))
      } else {
        if (!payload.slug || !payload.name) {
          toast.error(t("adminTiers.slugNameRequired"))
          return
        }
        await adminBillingApi.createTier({
          slug: payload.slug,
          name: payload.name,
          level: payload.level ?? 0,
          maxTeamMembers: payload.maxTeamMembers ?? undefined,
          priceMonthly: payload.priceMonthly ?? undefined,
          yearlyDiscountPercent: payload.yearlyDiscountPercent ?? undefined,
          features: payload.features ?? undefined,
          isActive: payload.isActive ?? true,
        })
        toast.success(t("adminTiers.createSuccess"))
      }
      setIsDialogOpen(false)
      resetForm()
      fetchTiers()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTiers.saveError"))
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (tier: SubscriptionTierDTO): Promise<void> => {
    try {
      setActionLoading(true)
      await adminBillingApi.updateTier(tier.id, { isActive: !tier.isActive })
      toast.success(
        t(tier.isActive ? "adminTiers.disabledSuccess" : "adminTiers.enabledSuccess"),
      )
      fetchTiers()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTiers.updateError"))
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (tier: SubscriptionTierDTO): Promise<void> => {
    if (!confirm(t("adminTiers.confirmDelete", { name: tier.name }))) {
      return
    }

    try {
      setActionLoading(true)
      await adminBillingApi.deleteTier(tier.id)
      toast.success(t("adminTiers.deleteSuccess"))
      fetchTiers()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTiers.deleteError"))
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("adminTiers.title")}</CardTitle>
              <CardDescription>
                {t("adminTiers.description")}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("adminTiers.newTier")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminTiers.tableName")}</TableHead>
                <TableHead>{t("adminTiers.tableSlug")}</TableHead>
                <TableHead>{t("adminTiers.tableLevel")}</TableHead>
                <TableHead>{t("adminTiers.tableTeamLimit")}</TableHead>
                <TableHead>{t("adminTiers.tablePriceMonthly")}</TableHead>
                <TableHead>{t("adminTiers.tableDiscount")}</TableHead>
                <TableHead>{t("adminTiers.tableStatus")}</TableHead>
                <TableHead className="text-right">{t("adminTiers.tableActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t("adminTiers.noTiers")}
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">{tier.name}</TableCell>
                    <TableCell className="font-mono text-sm">{tier.slug}</TableCell>
                    <TableCell>{tier.level}</TableCell>
                    <TableCell>{tier.maxTeamMembers ?? t("adminTiers.notAvailable")}</TableCell>
                    <TableCell>{tier.priceMonthly ?? t("adminTiers.notAvailable")}</TableCell>
                    <TableCell>{tier.yearlyDiscountPercent ?? t("adminTiers.notAvailable")}</TableCell>
                    <TableCell>
                      <Badge variant={tier.isActive ? "default" : "outline"}>
                        {tier.isActive ? t("adminTiers.active") : t("adminTiers.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(tier)}
                          disabled={actionLoading}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          {t("adminTiers.edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(tier)}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t("adminTiers.delete")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(tier)}
                          disabled={actionLoading}
                        >
                          {tier.isActive ? t("adminTiers.disable") : t("adminTiers.enable")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTier ? t("adminTiers.editTier") : t("adminTiers.createTier")}</DialogTitle>
            <DialogDescription>
              {t("adminTiers.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tier-name">{t("adminTiers.fieldName")}</Label>
              <Input
                id="tier-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier-slug">{t("adminTiers.fieldSlug")}</Label>
              <Input
                id="tier-slug"
                value={formData.slug}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, slug: event.target.value }))
                }
                disabled={!!editingTier}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier-level">{t("adminTiers.fieldLevel")}</Label>
              <Input
                id="tier-level"
                type="number"
                value={formData.level}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, level: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tier-team-limit">{t("adminTiers.fieldMaxTeamMembers")}</Label>
                <Input
                  id="tier-team-limit"
                  type="number"
                  value={formData.maxTeamMembers}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxTeamMembers: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tier-price-monthly">{t("adminTiers.fieldPriceMonthly")}</Label>
                <Input
                  id="tier-price-monthly"
                  type="number"
                  value={formData.priceMonthly}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      priceMonthly: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tier-discount">{t("adminTiers.fieldYearlyDiscount")}</Label>
                <Input
                  id="tier-discount"
                  type="number"
                  value={formData.yearlyDiscountPercent}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      yearlyDiscountPercent: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="tier-active"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                <Label htmlFor="tier-active">{t("adminTiers.active")}</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier-features">{t("adminTiers.fieldFeaturesJson")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("adminTiers.featuresHint")}
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="tier-quota-pending">{t("adminTiers.maxPendingInvitations")}</Label>
                  <Input
                    id="tier-quota-pending"
                    type="number"
                    min={1}
                    placeholder={t("adminTiers.noDefault")}
                    value={formData.quotaMaxPendingInvitations}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        quotaMaxPendingInvitations: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tier-quota-tenant-tokens">{t("adminTiers.maxTokensPerTenant")}</Label>
                  <Input
                    id="tier-quota-tenant-tokens"
                    type="number"
                    min={1}
                    placeholder={t("adminTiers.noDefault")}
                    value={formData.quotaMaxAuthTokensPerTenant}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        quotaMaxAuthTokensPerTenant: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tier-quota-user-tokens">{t("adminTiers.maxTokensPerUser")}</Label>
                  <Input
                    id="tier-quota-user-tokens"
                    type="number"
                    min={1}
                    placeholder={t("adminTiers.noDefault")}
                    value={formData.quotaMaxAuthTokensPerUser}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        quotaMaxAuthTokensPerUser: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Textarea
                id="tier-features"
                rows={6}
                value={formData.features}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, features: event.target.value }))
                }
                placeholder={t("adminTiers.featuresPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={actionLoading}
            >
              {t("adminTiers.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading}>
              {actionLoading ? t("adminTiers.saving") : t("adminTiers.saveTier")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
