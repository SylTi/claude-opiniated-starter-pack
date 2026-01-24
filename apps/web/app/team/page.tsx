"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api";
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
} from "lucide-react";
import {
  type TeamMemberDTO,
  type TeamInvitationDTO,
  type SubscriptionDTO,
} from "@saas/shared";

interface TeamData {
  id: number;
  name: string;
  slug: string;
  subscription?: SubscriptionDTO | null;
  ownerId: number | null;
  members: TeamMemberDTO[];
}

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

export default function TeamManagementPage(): React.ReactElement {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isSending, setIsSending] = useState(false);

  const fetchTeamData = useCallback(async (): Promise<void> => {
    if (!user?.currentTenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const [teamResponse, invitationsResponse] = await Promise.all([
        api.get<TeamData>(`/api/v1/teams/${user.currentTenantId}`),
        api.get<TeamInvitationDTO[]>(
          `/api/v1/teams/${user.currentTenantId}/invitations`,
        ),
      ]);

      if (teamResponse.data) {
        setTeam(teamResponse.data);
      }
      if (invitationsResponse.data) {
        setInvitations(invitationsResponse.data);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 401) {
          router.push("/login");
          return;
        }
        if (error.statusCode === 403) {
          toast.error("You don't have permission to manage this team");
          router.push("/dashboard");
          return;
        }
        toast.error(error.message);
      } else {
        toast.error("Failed to fetch team data");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.currentTenantId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      // Check if user has a team
      if (!user.currentTenantId) {
        toast.error("You are not part of any team");
        router.push("/dashboard");
        return;
      }

      // Check if user has paid subscription
      if (user.effectiveSubscriptionTier.level <= 0) {
        toast.error("Team management requires a paid subscription");
        router.push("/dashboard");
        return;
      }

      fetchTeamData();
    }
  }, [user, authLoading, router, fetchTeamData]);

  const handleSendInvitation = async (): Promise<void> => {
    if (!inviteEmail.trim() || !team) return;

    setIsSending(true);
    try {
      const response = await api.post<{ invitationLink: string }>(
        `/api/v1/teams/${team.id}/invitations`,
        {
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      );

      toast.success("Invitation sent successfully");
      setInviteEmail("");
      setInviteRole("member");
      fetchTeamData();

      // Show invitation link for testing
      if (response.data?.invitationLink) {
        console.log("Invitation link:", response.data.invitationLink);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to send invitation");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelInvitation = async (
    invitationId: number,
  ): Promise<void> => {
    if (!team) return;

    try {
      await api.delete(`/api/v1/teams/${team.id}/invitations/${invitationId}`);
      toast.success("Invitation cancelled");
      fetchTeamData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to cancel invitation");
      }
    }
  };

  const handleRemoveMember = async (userId: number): Promise<void> => {
    if (!team) return;

    try {
      await api.delete(`/api/v1/teams/${team.id}/members/${userId}`);
      toast.success("Member removed from team");
      fetchTeamData();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to remove member");
      }
    }
  };

  const isUserAdmin = useCallback((): boolean => {
    if (!team || !user) return false;
    const member = team.members.find((m) => m.userId === user.id);
    return member?.role === "owner" || member?.role === "admin";
  }, [team, user]);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!user || !team) {
    // Should have been redirected by useEffect, but show fallback just in case
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Redirecting...</p>
        </div>
      </div>
    );
  }

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending" && !inv.isExpired,
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">{team.name}</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your team members and invitations
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">
            {team.subscription?.tier.name ??
              user.effectiveSubscriptionTier.name}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {team.members.length} member{team.members.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Invite New Member */}
      {isUserAdmin() && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <CardTitle>Invite New Member</CardTitle>
            </div>
            <CardDescription>
              Send an invitation to add someone to your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select
                value={inviteRole}
                onValueChange={(value: "admin" | "member") =>
                  setInviteRole(value)
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
                Send Invite
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {isUserAdmin() && pendingInvitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Pending Invitations</CardTitle>
            </div>
            <CardDescription>
              {pendingInvitations.length} pending invitation
              {pendingInvitations.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        {invitation.role}
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
                              Cancel Invitation
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel this invitation to{" "}
                              {invitation.email}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleCancelInvitation(invitation.id)
                              }
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Cancel Invitation
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

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Team Members</CardTitle>
          </div>
          <CardDescription>Current members of {team.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isUserAdmin() && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {member.role === "owner" && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      {member.role === "admin" && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                      <div>
                        <div className="font-medium">
                          {member.user?.fullName || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.user?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  {isUserAdmin() && (
                    <TableCell className="text-right">
                      {member.role !== "owner" && member.userId !== user.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove{" "}
                                {member.user?.fullName || member.user?.email}{" "}
                                from the team?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleRemoveMember(member.userId)
                                }
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Warning for non-admins */}
      {!isUserAdmin() && (
        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <p>
                You can view team members but cannot make changes. Contact a
                team admin for assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
