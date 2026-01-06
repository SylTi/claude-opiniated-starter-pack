"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { api, ApiError, billingApi } from "@/lib/api";
import { toast } from "sonner";
import {
  User,
  Shield,
  Settings,
  Calendar,
  Activity,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Lock,
  Zap,
  Crown,
  Star,
  Users,
  Building2,
} from "lucide-react";
import {
  type BillingTierDTO,
  type SubscriptionTierDTO,
} from "@saas/shared";

interface UserStats {
  accountAgeDays: number;
  totalLogins: number;
  lastLoginAt: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  subscriptionTier: SubscriptionTierDTO;
  connectedOAuthAccounts: number;
  recentActivity: Array<{
    method: string;
    success: boolean;
    ipAddress: string | null;
    createdAt: string;
  }>;
}

function hasAccessToLevel(userLevel: number, requiredLevel: number): boolean {
  return userLevel >= requiredLevel;
}

function getTierBadgeVariant(
  level: number
): "default" | "secondary" | "destructive" | "outline" {
  if (level >= 2) return "default";
  if (level >= 1) return "secondary";
  return "outline";
}

function formatTierFeatures(features: Record<string, unknown> | null): string[] {
  if (!features) return [];
  return Object.entries(features).reduce<string[]>((acc, [key, value]) => {
    if (typeof value === "boolean") {
      if (value) {
        acc.push(key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
      }
    } else if (typeof value === "number") {
      acc.push(`${value} ${key.replace(/_/g, " ")}`);
    } else if (typeof value === "string") {
      acc.push(`${value} ${key.replace(/_/g, " ")}`.trim());
    }
    return acc;
  }, []);
}

export default function DashboardPage(): React.ReactElement {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tiers, setTiers] = useState<BillingTierDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async (): Promise<void> => {
    try {
      const [statsResponse, tiersResponse] = await Promise.all([
        api.get<UserStats>("/api/v1/dashboard/stats"),
        billingApi.getTiers(),
      ]);
      if (statsResponse.data) {
        setStats(statsResponse.data);
      }
      setTiers(tiersResponse);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 401) {
          router.push("/login");
          return;
        }
        toast.error(error.message);
      } else {
        toast.error("Failed to fetch dashboard stats");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      fetchDashboardData();
    }
  }, [user, authLoading, router, fetchDashboardData]);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <></>;
  }

  const sortedTiers = [...tiers].sort((a, b) => a.tier.level - b.tier.level);
  const freeTierLevel =
    sortedTiers.find((tier) => tier.tier.slug === "free")?.tier.level ?? 0;
  const hasPaidTier = user.effectiveSubscriptionTier.level > freeTierLevel;

  function formatDate(dateString: string | null): string {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatAccountAge(days: number): string {
    if (days === 0) return "Today";
    if (days === 1) return "1 day";
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user.fullName || user.email.split("@")[0]}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your account
        </p>
      </div>

      {/* Account Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Age</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? formatAccountAge(stats.accountAgeDays) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Member since signup</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLogins ?? 0}</div>
            <p className="text-xs text-muted-foreground">Successful sign-ins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Status</CardTitle>
            {user.emailVerified ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.emailVerified ? "Verified" : "Unverified"}
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.mfaEnabled ? "Protected" : "Basic"}
            </div>
            <p className="text-xs text-muted-foreground">
              {user.mfaEnabled ? "2FA enabled" : "2FA not enabled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team & Subscription Info */}
      {(user.currentTeamId || user.effectiveSubscriptionTier.slug !== "free") && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <CardTitle>Subscription & Team</CardTitle>
            </div>
            <CardDescription>Your current subscription and team information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Subscription</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Plan:</span>
                    <Badge variant={getTierBadgeVariant(user.effectiveSubscriptionTier.level)}>
                      {user.effectiveSubscriptionTier.name}
                    </Badge>
                  </div>
                  {user.currentTeam?.subscription?.expiresAt && (
                    <div className="text-sm text-muted-foreground">
                      Expires: {new Date(user.currentTeam.subscription.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                  {!user.currentTeamId && user.subscription?.expiresAt && (
                    <div className="text-sm text-muted-foreground">
                      Expires: {new Date(user.subscription.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              {user.currentTeam && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Team</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{user.currentTeam.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Slug: {user.currentTeam.slug}
                    </div>
                    {hasPaidTier && (
                      <Link href="/team">
                        <Button variant="link" size="sm" className="p-0 h-auto">
                          Manage Team <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/profile" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Edit Profile
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/profile/security" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security Settings
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/profile/settings" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Connected Accounts
                  {stats && stats.connectedOAuthAccounts > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {stats.connectedOAuthAccounts}
                    </Badge>
                  )}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/profile/settings" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest login attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {stats && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {activity.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="capitalize">{activity.method}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(activity.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscription Tier Sections */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Features by Subscription</h2>
            <p className="text-muted-foreground">
              Your current plan:{" "}
              <Badge variant={getTierBadgeVariant(user.effectiveSubscriptionTier.level)}>
                {user.effectiveSubscriptionTier.name}
              </Badge>
              {user.currentTeam && (
                <span className="ml-2 text-sm">(via {user.currentTeam.name})</span>
              )}
            </p>
          </div>
        </div>

        {sortedTiers.length === 0 ? (
          <Card className="border-2 border-gray-200">
            <CardHeader>
              <CardTitle>Subscription tiers unavailable</CardTitle>
              <CardDescription>
                We couldn&apos;t load tier details right now. Please refresh.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {sortedTiers.map((tierData) => {
              const tier = tierData.tier;
              const features = formatTierFeatures(tier.features);
              const canAccess = hasAccessToLevel(
                user.effectiveSubscriptionTier.level,
                tier.level
              );
              const isPremium = tier.level >= 2;
              const isMid = tier.level === 1;
              const cardBorder = isPremium
                ? "border-yellow-200"
                : isMid
                ? "border-blue-200"
                : "border-gray-200";
              const featureBg = isPremium
                ? "bg-yellow-50"
                : isMid
                ? "bg-blue-50"
                : "bg-gray-50";
              const Icon = isPremium ? Crown : isMid ? Zap : Star;

              return (
                <Card key={tier.id} className={`border-2 ${cardBorder}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-5 w-5 ${
                            isPremium
                              ? "text-yellow-500"
                              : isMid
                              ? "text-blue-500"
                              : "text-gray-500"
                          }`}
                        />
                        <CardTitle>{tier.name} Features</CardTitle>
                      </div>
                      <Badge variant={getTierBadgeVariant(tier.level)}>
                        {tier.name}
                      </Badge>
                    </div>
                    <CardDescription>
                      {tier.description ?? `${tier.name} tier features`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {canAccess ? (
                      features.length > 0 ? (
                        <div className="space-y-4">
                          {features.map((feature) => (
                            <div
                              key={feature}
                              className={`p-4 ${featureBg} rounded-lg`}
                            >
                              <h4 className="font-medium mb-2">{feature}</h4>
                              <p className="text-sm text-muted-foreground">
                                Included with {tier.name}.
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
                          <p className="text-muted-foreground">
                            You have access to {tier.name}.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">
                          Upgrade to {tier.name} to unlock
                        </p>
                        <Button variant="outline" size="sm">
                          Upgrade
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
