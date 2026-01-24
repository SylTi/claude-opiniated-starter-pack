"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { adminTeamsApi, adminBillingApi, ApiError } from "@/lib/api"
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
import type { AdminTeamDTO, SubscriptionTierDTO } from "@saas/shared"

export default function AdminTeamsPage(): React.ReactElement {
  const router = useRouter()
  const [teams, setTeams] = useState<AdminTeamDTO[]>([])
  const [tiers, setTiers] = useState<SubscriptionTierDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [teamsData, tiersData] = await Promise.all([
        adminTeamsApi.list(),
        adminBillingApi.listTiers(),
      ])
      setTeams(teamsData)
      setTiers(tiersData)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
        if (error.statusCode === 401 || error.statusCode === 403) {
          router.push("/dashboard")
        }
      } else {
        toast.error("Failed to fetch teams")
      }
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpdateTier(teamId: number, tier: string): Promise<void> {
    setActionLoading(teamId)
    try {
      await adminTeamsApi.updateTier(teamId, { subscriptionTier: tier })
      toast.success("Team subscription tier updated successfully")
      fetchData()
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
        <CardTitle>Team Management</CardTitle>
        <CardDescription>
          View and manage all teams. Update subscription tiers for teams.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
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
            {teams.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground py-8"
                >
                  No teams found
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-mono text-sm">{team.id}</TableCell>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {team.slug}
                  </TableCell>
                  <TableCell>{team.ownerEmail || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{team.memberCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={team.subscriptionTier}
                      onValueChange={(value: string) =>
                        handleUpdateTier(team.id, value)
                      }
                      disabled={
                        actionLoading === team.id || tierOptions.length === 0
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue>
                          {(() => {
                            const tier = getTierBySlug(team.subscriptionTier)
                            const tierLabel =
                              tier?.name ?? team.subscriptionTier
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
                          <SelectItem value={team.subscriptionTier}>
                            <Badge variant={getTierBadgeVariant(0)}>
                              {team.subscriptionTier}
                            </Badge>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {team.balance > 0 ? (
                      <Badge variant="secondary" className="bg-green-100">
                        {formatBalance(team.balance, team.balanceCurrency)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(team.subscriptionExpiresAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(team.createdAt)}
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
