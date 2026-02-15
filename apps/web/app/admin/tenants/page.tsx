"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminTenantsApi, adminBillingApi, ApiError } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useI18n } from "@/contexts/i18n-context"
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
import { Button } from "@saas/ui/button"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@saas/ui/dialog"
import { toast } from "sonner"
import type {
  AdminTenantDTO,
  AdminTenantQuotasDTO,
  SubscriptionTierDTO,
} from "@saas/shared"
import { Loader2, SlidersHorizontal } from "lucide-react"

export default function AdminTenantsPage(): React.ReactElement {
  const { locale, t } = useI18n("skeleton")
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [tenants, setTenants] = useState<AdminTenantDTO[]>([])
  const [tiers, setTiers] = useState<SubscriptionTierDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [quotaSaving, setQuotaSaving] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<AdminTenantDTO | null>(null)
  const [selectedTenantQuotas, setSelectedTenantQuotas] =
    useState<AdminTenantQuotasDTO | null>(null)
  const [quotaForm, setQuotaForm] = useState({
    maxMembers: "",
    maxPendingInvitations: "",
    maxAuthTokensPerTenant: "",
    maxAuthTokensPerUser: "",
  })

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [tenantsData, tiersData] = await Promise.all([
        adminTenantsApi.list(),
        adminBillingApi.listTiers(),
      ])
      setTenants(tenantsData)
      setTiers(tiersData)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
        if (error.statusCode === 401 || error.statusCode === 403) {
          router.push("/dashboard")
        }
      } else {
        toast.error(t("adminTenants.fetchError"))
      }
    } finally {
      setIsLoading(false)
    }
  }, [router, t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpdateTier(tenantId: number, tier: string): Promise<void> {
    setActionLoading(tenantId)
    try {
      await adminTenantsApi.updateTier(tenantId, { subscriptionTier: tier })
      toast.success(t("adminTenants.tierUpdateSuccess"))
      await fetchData()

      // Keep the current session in sync if its active tenant tier changed.
      if (user?.currentTenantId === tenantId) {
        await refreshUser()
        router.refresh()
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTenants.tierUpdateError"))
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function openQuotaDialog(tenant: AdminTenantDTO): Promise<void> {
    setSelectedTenant(tenant)
    setQuotaDialogOpen(true)
    setQuotaLoading(true)
    setSelectedTenantQuotas(null)

    try {
      const quotaData = await adminTenantsApi.getQuotas(tenant.id)
      setSelectedTenantQuotas(quotaData)
      setQuotaForm({
        maxMembers: quotaData.maxMembers?.toString() ?? "",
        maxPendingInvitations:
          quotaData.quotaOverrides.maxPendingInvitations?.toString() ?? "",
        maxAuthTokensPerTenant:
          quotaData.quotaOverrides.maxAuthTokensPerTenant?.toString() ?? "",
        maxAuthTokensPerUser:
          quotaData.quotaOverrides.maxAuthTokensPerUser?.toString() ?? "",
      })
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTenants.loadQuotasError"))
      }
      setQuotaDialogOpen(false)
      setSelectedTenant(null)
    } finally {
      setQuotaLoading(false)
    }
  }

  async function handleSaveQuotas(): Promise<void> {
    if (!selectedTenant) {
      return
    }

    try {
      setQuotaSaving(true)
      const payload = {
        maxMembers: normalizeLimitInput(quotaForm.maxMembers),
        maxPendingInvitations: normalizeLimitInput(quotaForm.maxPendingInvitations),
        maxAuthTokensPerTenant: normalizeLimitInput(quotaForm.maxAuthTokensPerTenant),
        maxAuthTokensPerUser: normalizeLimitInput(quotaForm.maxAuthTokensPerUser),
      }

      const updated = await adminTenantsApi.updateQuotas(selectedTenant.id, payload)
      setSelectedTenantQuotas(updated)
      setTenants((current) =>
        current.map((tenant) =>
          tenant.id === selectedTenant.id
            ? {
                ...tenant,
                maxMembers: updated.maxMembers,
                quotaOverrides: updated.quotaOverrides,
              }
            : tenant,
        ),
      )
      toast.success(t("adminTenants.quotasUpdateSuccess"))
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error(t("adminTenants.quotasUpdateError"))
      }
    } finally {
      setQuotaSaving(false)
    }
  }

  function getTierBadgeVariant(
    level: number,
  ): "default" | "secondary" | "outline" {
    if (level >= 2) return "default"
    if (level >= 1) return "secondary"
    return "outline"
  }

  function getTypeBadgeVariant(
    type: string,
  ): "default" | "secondary" | "outline" {
    return type === "personal" ? "outline" : "secondary"
  }

  function getTierBySlug(slug: string): SubscriptionTierDTO | undefined {
    return tiers.find((tier) => tier.slug === slug)
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return t("adminTenants.notAvailable")
    return new Date(dateString).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function formatBalance(amount: number, currency: string): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  function normalizeLimitInput(value: string): number | null {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(t("adminTenants.limitValidationError"))
    }
    return parsed
  }

  function formatLimit(limit: number | null | undefined): string {
    if (limit === null || limit === undefined) {
      return t("adminTenants.tierDefaultUnlimited")
    }
    return String(limit)
  }

  const tierOptions = [...tiers].sort((a, b) => a.level - b.level)

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
          <CardTitle>{t("adminTenants.title")}</CardTitle>
          <CardDescription>
            {t("adminTenants.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminTenants.tableId")}</TableHead>
                <TableHead>{t("adminTenants.tableName")}</TableHead>
                <TableHead>{t("adminTenants.tableType")}</TableHead>
                <TableHead>{t("adminTenants.tableSlug")}</TableHead>
                <TableHead>{t("adminTenants.tableOwner")}</TableHead>
                <TableHead>{t("adminTenants.tableMembers")}</TableHead>
                <TableHead>{t("adminTenants.tableSubscription")}</TableHead>
                <TableHead>{t("adminTenants.tableBalance")}</TableHead>
                <TableHead>{t("adminTenants.tableExpires")}</TableHead>
                <TableHead>{t("adminTenants.tableCreated")}</TableHead>
                <TableHead>{t("adminTenants.tableQuotaOverrides")}</TableHead>
                <TableHead className="text-right">{t("adminTenants.tableActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t("adminTenants.noTenants")}
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                  <TableCell className="font-mono text-sm">{tenant.id}</TableCell>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <Badge variant={getTypeBadgeVariant(tenant.type)}>
                      {tenant.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {tenant.slug}
                  </TableCell>
                  <TableCell>{tenant.ownerEmail || t("adminTenants.notAvailable")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tenant.memberCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={tenant.subscriptionTier}
                      onValueChange={(value: string) =>
                        handleUpdateTier(tenant.id, value)
                      }
                      disabled={
                        actionLoading === tenant.id || tierOptions.length === 0
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue>
                          {(() => {
                            const tier = getTierBySlug(tenant.subscriptionTier)
                            const tierLabel =
                              tier?.name ?? tenant.subscriptionTier
                            const tierLevel = tier?.level ?? 0
                            return (
                              <Badge variant={getTierBadgeVariant(tierLevel)}>
                                {tierLabel}
                              </Badge>
                            )
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tierOptions.length > 0 ? (
                          tierOptions.map((tier) => (
                            <SelectItem key={tier.id} value={tier.slug}>
                              <Badge variant={getTierBadgeVariant(tier.level)}>
                                {tier.name}
                              </Badge>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={tenant.subscriptionTier}>
                            <Badge variant={getTierBadgeVariant(0)}>
                              {tenant.subscriptionTier}
                            </Badge>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {tenant.balance > 0 ? (
                      <Badge variant="secondary">
                        {formatBalance(tenant.balance, tenant.balanceCurrency)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{t("adminTenants.notAvailable")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tenant.subscriptionExpiresAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tenant.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>{t("adminTenants.quotaMembers", { value: formatLimit(tenant.maxMembers) })}</div>
                      <div>
                        {t("adminTenants.quotaPendingInvites", {
                          value: formatLimit(tenant.quotaOverrides?.maxPendingInvitations),
                        })}
                      </div>
                      <div>
                        {t("adminTenants.quotaTenantTokens", {
                          value: formatLimit(tenant.quotaOverrides?.maxAuthTokensPerTenant),
                        })}
                      </div>
                      <div>
                        {t("adminTenants.quotaUserTokens", {
                          value: formatLimit(tenant.quotaOverrides?.maxAuthTokensPerUser),
                        })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openQuotaDialog(tenant)}
                      disabled={quotaLoading || quotaSaving}
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      {t("adminTenants.limits")}
                    </Button>
                  </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={quotaDialogOpen}
        onOpenChange={(open) => {
          setQuotaDialogOpen(open)
          if (!open) {
            setSelectedTenant(null)
            setSelectedTenantQuotas(null)
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {t("adminTenants.dialogTitle")}
              {selectedTenant ? ` - ${selectedTenant.name}` : ""}
            </DialogTitle>
            <DialogDescription>
              {t("adminTenants.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {quotaLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quota-max-members">{t("adminTenants.maxMembers")}</Label>
                <Input
                  id="quota-max-members"
                  inputMode="numeric"
                  placeholder={t("adminTenants.tierDefaultPlaceholder")}
                  value={quotaForm.maxMembers}
                  onChange={(event) =>
                    setQuotaForm((prev) => ({
                      ...prev,
                      maxMembers: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("adminTenants.effective")}{" "}
                  {formatLimit(selectedTenantQuotas?.effectiveLimits.members)}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="quota-max-invitations">{t("adminTenants.maxPendingInvitations")}</Label>
                <Input
                  id="quota-max-invitations"
                  inputMode="numeric"
                  placeholder={t("adminTenants.tierDefaultPlaceholder")}
                  value={quotaForm.maxPendingInvitations}
                  onChange={(event) =>
                    setQuotaForm((prev) => ({
                      ...prev,
                      maxPendingInvitations: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("adminTenants.effective")}{" "}
                  {formatLimit(
                    selectedTenantQuotas?.effectiveLimits.pendingInvitations,
                  )}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="quota-max-tenant-tokens">{t("adminTenants.maxTokensPerTenant")}</Label>
                <Input
                  id="quota-max-tenant-tokens"
                  inputMode="numeric"
                  placeholder={t("adminTenants.tierDefaultPlaceholder")}
                  value={quotaForm.maxAuthTokensPerTenant}
                  onChange={(event) =>
                    setQuotaForm((prev) => ({
                      ...prev,
                      maxAuthTokensPerTenant: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("adminTenants.effective")}{" "}
                  {formatLimit(
                    selectedTenantQuotas?.effectiveLimits.authTokensPerTenant,
                  )}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="quota-max-user-tokens">{t("adminTenants.maxTokensPerUser")}</Label>
                <Input
                  id="quota-max-user-tokens"
                  inputMode="numeric"
                  placeholder={t("adminTenants.tierDefaultPlaceholder")}
                  value={quotaForm.maxAuthTokensPerUser}
                  onChange={(event) =>
                    setQuotaForm((prev) => ({
                      ...prev,
                      maxAuthTokensPerUser: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("adminTenants.effective")}{" "}
                  {formatLimit(
                    selectedTenantQuotas?.effectiveLimits.authTokensPerUser,
                  )}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuotaDialogOpen(false)}
              disabled={quotaSaving}
            >
              {t("adminTenants.close")}
            </Button>
            <Button
              onClick={handleSaveQuotas}
              disabled={quotaLoading || quotaSaving}
            >
              {quotaSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("adminTenants.saveLimits")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
