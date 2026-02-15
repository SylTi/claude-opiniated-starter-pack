"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas/ui/card";
import { Button } from "@saas/ui/button";
import { Input } from "@saas/ui/input";
import { Badge } from "@saas/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saas/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@saas/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { tenantsApi, ApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  Loader2,
  Crown,
  Shield,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  type TenantInvitationDTO,
  type TenantRole,
  type TenantWithMembersDTO,
} from "@saas/shared";

type TenantData = TenantWithMembersDTO;

function getRoleBadgeVariant(
  role: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "owner":
      return "default";
    case "admin":
      return "secondary";
    default:
      return "outline";
  }
}

function formatQuota(limit: number | null, used: number): string {
  if (limit === null) {
    return `${used} / \u221e`;
  }
  return `${used} / ${limit}`;
}

export default function TenantManagementPage(): React.ReactElement {
  const { t } = useI18n("skeleton");
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [invitations, setInvitations] = useState<TenantInvitationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [isSending, setIsSending] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);

  const fetchTenantData = useCallback(async (): Promise<void> => {
    if (!user?.currentTenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const [tenantData, invitationsData] = await Promise.all([
        tenantsApi.get(user.currentTenantId),
        tenantsApi.getInvitations(user.currentTenantId),
      ]);

      setTenant(tenantData);
      setInvitations(invitationsData);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 401) {
          router.push("/login");
          return;
        }
        if (error.statusCode === 403) {
          toast.error(t("team.permissionDenied"));
          router.push("/dashboard");
          return;
        }
        toast.error(error.message);
      } else {
        toast.error(t("team.fetchError"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.currentTenantId, router, t]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      // Check if user has a tenant
      if (!user.currentTenantId) {
        toast.error(t("team.notPartOfTenant"));
        router.push("/dashboard");
        return;
      }

      // Check if user has paid subscription
      if (user.effectiveSubscriptionTier.level <= 0) {
        toast.error(t("team.requiresPaidTier"));
        router.push("/dashboard");
        return;
      }

      fetchTenantData();
    }
  }, [user, authLoading, router, fetchTenantData, t]);

  const handleSendInvitation = async (): Promise<void> => {
    if (!inviteEmail.trim() || !tenant) return;

    setIsSending(true);
    try {
      const response = await tenantsApi.sendInvitation(tenant.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      toast.success(t("team.invitationSent"));
      setInviteEmail("");
      setInviteRole("member");
      fetchTenantData();

      // Show invitation link for testing
      if (response.invitationLink) {
        console.log("Invitation link:", response.invitationLink);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("team.invitationSendError"));
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelInvitation = async (
    invitationId: number,
  ): Promise<void> => {
    if (!tenant) return;

    try {
      await tenantsApi.cancelInvitation(tenant.id, invitationId);
      toast.success(t("team.invitationCancelled"));
      fetchTenantData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("team.invitationCancelError"));
      }
    }
  };

  const handleRemoveMember = async (userId: number): Promise<void> => {
    if (!tenant) return;

    try {
      await tenantsApi.removeMember(tenant.id, userId);
      toast.success(t("team.memberRemoved"));
      fetchTenantData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("team.memberRemoveError"));
      }
    }
  };

  const handleUpdateMemberRole = async (
    userId: number,
    role: TenantRole,
  ): Promise<void> => {
    if (!tenant) return;

    setUpdatingMemberId(userId);
    try {
      await tenantsApi.updateMemberRole(tenant.id, userId, { role });
      toast.success(t("team.memberRoleUpdated"));
      fetchTenantData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("team.memberRoleUpdateError"));
      }
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const isUserAdmin = useCallback((): boolean => {
    if (!tenant || !user) return false;
    const member = tenant.members.find((m) => m.userId === user.id);
    return member?.role === "owner" || member?.role === "admin";
  }, [tenant, user]);

  const isUserOwner = useCallback((): boolean => {
    if (!tenant || !user) return false;
    const member = tenant.members.find((m) => m.userId === user.id);
    return member?.role === "owner";
  }, [tenant, user]);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!user || !tenant) {
    // Should have been redirected by useEffect, but show fallback just in case
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>{t("team.redirecting")}</p>
        </div>
      </div>
    );
  }

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending" && !inv.isExpired,
  );
  const userIsAdmin = isUserAdmin();
  const userIsOwner = isUserOwner();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
        </div>
        <p className="text-muted-foreground">
          {t("team.subtitle")}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">
            {tenant.subscription?.tier.name ??
              user.effectiveSubscriptionTier.name}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {t("team.memberCount", { count: tenant.members.length })}
          </span>
        </div>
      </div>

      {tenant.quotas && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t("team.quotasTitle")}</CardTitle>
            <CardDescription>
              {t("team.quotasDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">{t("team.membersLabel")}</span>
              <span className="font-medium">
                {formatQuota(tenant.quotas.members.limit, tenant.quotas.members.used)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">
                {t("team.pendingInvitationsLabel")}
              </span>
              <span className="font-medium">
                {formatQuota(
                  tenant.quotas.pendingInvitations.limit,
                  tenant.quotas.pendingInvitations.used,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">
                {t("team.authTokensTenantLabel")}
              </span>
              <span className="font-medium">
                {formatQuota(
                  tenant.quotas.authTokensPerTenant.limit,
                  tenant.quotas.authTokensPerTenant.used,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">
                {t("team.authTokensCurrentUserLabel")}
              </span>
              <span className="font-medium">
                {formatQuota(
                  tenant.quotas.authTokensPerUser.limit,
                  tenant.quotas.authTokensPerUser.used,
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite New Member */}
      {userIsAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <CardTitle>{t("team.inviteTitle")}</CardTitle>
            </div>
            <CardDescription>
              {t("team.inviteDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder={t("team.emailAddress")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                value={inviteRole}
                onValueChange={(value: "admin" | "member" | "viewer") =>
                  setInviteRole(value)
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("team.role")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{t("team.roleMember")}</SelectItem>
                  <SelectItem value="viewer">{t("team.roleViewer")}</SelectItem>
                  <SelectItem value="admin">{t("team.roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleSendInvitation}
                disabled={isSending || !inviteEmail.trim()}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {t("team.sendInvite")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {userIsAdmin && pendingInvitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>{t("team.pendingInvitationsTitle")}</CardTitle>
            </div>
            <CardDescription>
              {t("team.pendingInvitationsCount", { count: pendingInvitations.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("team.tableEmail")}</TableHead>
                  <TableHead>{t("team.tableRole")}</TableHead>
                  <TableHead>{t("team.tableExpires")}</TableHead>
                  <TableHead className="text-right">{t("team.tableActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role)}>
                        {t(`team.role.${invitation.role}`, undefined, invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("team.cancelInvitationTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("team.cancelInvitationDescription", { email: invitation.email })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("team.keep")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleCancelInvitation(invitation.id)
                              }
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {t("team.cancelInvitationAction")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tenant Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>{t("team.membersTitle")}</CardTitle>
          </div>
          <CardDescription>{t("team.currentMembersOf", { tenant: tenant.name })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("team.tableMember")}</TableHead>
                <TableHead>{t("team.tableRole")}</TableHead>
                <TableHead>{t("team.tableJoined")}</TableHead>
                {userIsAdmin && (
                  <TableHead className="text-right">{t("team.tableActions")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenant.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {member.role === "owner" && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      {member.role === "admin" && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                      {member.role === "viewer" && (
                        <Eye className="h-4 w-4 text-slate-500" />
                      )}
                      <div>
                        <div className="font-medium">
                          {member.user?.fullName || t("team.unknownUser")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.user?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {t(`team.role.${member.role}`, undefined, member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  {userIsAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {userIsOwner &&
                          member.role !== "owner" &&
                          member.userId !== user.id && (
                            <Select
                              value={member.role}
                              onValueChange={(
                                value: "admin" | "member" | "viewer",
                              ) =>
                                handleUpdateMemberRole(
                                  member.userId,
                                  value as TenantRole,
                                )
                              }
                              disabled={updatingMemberId === member.userId}
                            >
                              <SelectTrigger className="w-[130px] h-8">
                                <SelectValue placeholder={t("team.role")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">{t("team.roleViewer")}</SelectItem>
                                <SelectItem value="member">{t("team.roleMember")}</SelectItem>
                                <SelectItem value="admin">{t("team.roleAdmin")}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        {member.role !== "owner" && member.userId !== user.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("team.removeMemberTitle")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("team.removeMemberDescription", {
                                    user: member.user?.fullName || member.user?.email || "",
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("team.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleRemoveMember(member.userId)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {t("team.remove")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Warning for non-admins */}
      {!userIsAdmin && (
        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <p>
                {t("team.readOnlyWarning")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
