"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas/ui/card"
import { Button } from "@saas/ui/button"
import { Badge } from "@saas/ui/badge"
import { api, ApiError } from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import { toast } from "sonner"
import {
  Users,
  UserCheck,
  Shield,
  TrendingUp,
  Activity,
  ArrowRight,
} from "lucide-react"

interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  mfaEnabledUsers: number;
  newUsersThisMonth: number;
  activeUsersThisWeek: number;
  usersByRole: Array<{ role: string; count: number }>;
}

export default function AdminDashboardPage(): React.ReactElement {
  const { t } = useI18n("skeleton")
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const response = await api.get<AdminStats>("/api/v1/admin/stats")
      if (response.data) {
        setStats(response.data)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
        if (error.statusCode === 401 || error.statusCode === 403) {
          router.push("/dashboard")
        }
      } else {
        toast.error(t("adminDashboard.fetchError"))
      }
    } finally {
      setIsLoading(false)
    }
  }, [router, t])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (isLoading) {
    return (
      <div className="space-y-6">
      <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("adminDashboard.loadStatsError")}
        </CardContent>
      </Card>
    )
  }

  const verificationRate =
    stats.totalUsers > 0
      ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100)
      : 0

  const mfaRate =
    stats.totalUsers > 0
      ? Math.round((stats.mfaEnabledUsers / stats.totalUsers) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("adminDashboard.title")}</h1>
        <p className="text-muted-foreground">
          {t("adminDashboard.subtitle")}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("adminDashboard.totalUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {t("adminDashboard.newUsersThisMonth", { count: stats.newUsersThisMonth })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("adminDashboard.verifiedUsers")}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedUsers}</div>
            <p className="text-xs text-muted-foreground">
              {t("adminDashboard.verificationRate", { rate: verificationRate })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("adminDashboard.mfaEnabled")}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mfaEnabledUsers}</div>
            <p className="text-xs text-muted-foreground">
              {t("adminDashboard.adoptionRate", { rate: mfaRate })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("adminDashboard.activeThisWeek")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsersThisWeek}</div>
            <p className="text-xs text-muted-foreground">{t("adminDashboard.uniqueLogins")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t("adminDashboard.usersByRole")}
            </CardTitle>
            <CardDescription>{t("adminDashboard.usersByRoleDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.usersByRole.map((item) => (
                <div
                  key={item.role}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.role === "admin" ? "default" : "secondary"}
                    >
                      {item.role}
                    </Badge>
                  </div>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("adminDashboard.quickActions")}</CardTitle>
            <CardDescription>{t("adminDashboard.quickActionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/users" className="block">
              <Button variant="outline" className="w-full justify-between">
                {t("adminDashboard.manageUsers")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-between" disabled>
              {t("adminDashboard.viewLogs")}
              <Badge variant="secondary" className="text-xs">
                {t("adminDashboard.comingSoon")}
              </Badge>
            </Button>
            <Button variant="outline" className="w-full justify-between" disabled>
              {t("adminDashboard.systemSettings")}
              <Badge variant="secondary" className="text-xs">
                {t("adminDashboard.comingSoon")}
              </Badge>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
