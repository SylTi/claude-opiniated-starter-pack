"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminTenantsApi, adminBillingApi, ApiError } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { AdminTenantDTO, SubscriptionTierDTO } from "@saas/shared"

export default function AdminTenantsPage(): React.ReactElement {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [tenants, setTenants] = useState<AdminTenantDTO[]>([])
  const [tiers, setTiers] = useState<SubscriptionTierDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

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
        toast.error("Failed to fetch tenants")
      }
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpdateTier(tenantId: number, tier: string): Promise<void> {
    setActionLoading(tenantId)
    try {
      await adminTenantsApi.updateTier(tenantId, { subscriptionTier: tier })
      toast.success("Tenant subscription tier updated successfully")
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
        toast.error("Failed to update subscription tier")
      }
    } finally {
      setActionLoading(null)
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
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function formatBalance(amount: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const tierOptions = [...tiers].sort((a, b) => a.level - b.level)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant Management</CardTitle>
        <CardDescription>
          View and manage all tenants (personal workspaces and teams). Update subscription tiers for tenants.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground py-8"
                >
                  No tenants found
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
                  <TableCell>{tenant.ownerEmail || "-"}</TableCell>
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
                      <Badge variant="secondary" className="bg-green-100">
                        {formatBalance(tenant.balance, tenant.balanceCurrency)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tenant.subscriptionExpiresAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tenant.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
