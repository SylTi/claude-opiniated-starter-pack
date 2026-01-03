"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  type AdminUserDTO,
  type SubscriptionTier,
  SUBSCRIPTION_TIER_LABELS,
} from "@saas/shared";

export default function AdminUsersPage(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: number | null; email: string }>({
    open: false,
    userId: null,
    email: "",
  });

  const fetchUsers = useCallback(async (): Promise<void> => {
    try {
      const response = await api.get<AdminUserDTO[]>("/api/v1/admin/users");
      if (response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
        if (error.statusCode === 401 || error.statusCode === 403) {
          router.push("/dashboard");
        }
      } else {
        toast.error("Failed to fetch users");
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleVerifyEmail(userId: number): Promise<void> {
    setActionLoading(userId);
    try {
      await api.post(`/api/v1/admin/users/${userId}/verify-email`);
      toast.success("Email verified successfully");
      fetchUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to verify email");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnverifyEmail(userId: number): Promise<void> {
    setActionLoading(userId);
    try {
      await api.post(`/api/v1/admin/users/${userId}/unverify-email`);
      toast.success("Email unverified successfully");
      fetchUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to unverify email");
      }
    } finally {
      setActionLoading(null);
    }
  }

  function openDeleteDialog(userId: number, email: string): void {
    setDeleteDialog({ open: true, userId, email });
  }

  function closeDeleteDialog(): void {
    setDeleteDialog({ open: false, userId: null, email: "" });
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteDialog.userId) return;

    setActionLoading(deleteDialog.userId);
    try {
      await api.delete(`/api/v1/admin/users/${deleteDialog.userId}`);
      toast.success("User deleted successfully");
      closeDeleteDialog();
      fetchUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete user");
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUpdateTier(
    userId: number,
    tier: SubscriptionTier,
  ): Promise<void> {
    setActionLoading(userId);
    try {
      await api.put(`/api/v1/admin/users/${userId}/tier`, {
        subscriptionTier: tier,
      });
      toast.success("Subscription tier updated successfully");
      fetchUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update subscription tier");
      }
    } finally {
      setActionLoading(null);
    }
  }

  function getTierBadgeVariant(
    tier: SubscriptionTier,
  ): "default" | "secondary" | "outline" {
    switch (tier) {
      case "tier2":
        return "default";
      case "tier1":
        return "secondary";
      default:
        return "outline";
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <>
    <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage registered users. Manually verify email addresses
            while email sending is not configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Email Status</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-sm">{u.id}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.fullName || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                      >
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.subscriptionTier}
                        onValueChange={(value: SubscriptionTier) =>
                          handleUpdateTier(u.id, value)
                        }
                        disabled={actionLoading === u.id}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue>
                            <Badge variant={getTierBadgeVariant(u.subscriptionTier as SubscriptionTier)}>
                              {SUBSCRIPTION_TIER_LABELS[u.subscriptionTier as SubscriptionTier]}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">
                            <Badge variant="outline">Free</Badge>
                          </SelectItem>
                          <SelectItem value="tier1">
                            <Badge variant="secondary">Tier 1</Badge>
                          </SelectItem>
                          <SelectItem value="tier2">
                            <Badge variant="default">Tier 2</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.emailVerified ? (
                        <Badge variant="default" className="bg-green-600">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Unverified</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.mfaEnabled ? (
                        <Badge variant="default" className="bg-blue-600">
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {u.emailVerified ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnverifyEmail(u.id)}
                            disabled={actionLoading === u.id}
                          >
                            {actionLoading === u.id ? "Loading..." : "Unverify"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleVerifyEmail(u.id)}
                            disabled={actionLoading === u.id}
                          >
                            {actionLoading === u.id ? "Loading..." : "Verify"}
                          </Button>
                        )}
                        {u.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDeleteDialog(u.id, u.email)}
                            disabled={actionLoading === u.id}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
    </Card>

    <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && closeDeleteDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete user {deleteDialog.email}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeDeleteDialog}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={actionLoading !== null}>
            {actionLoading !== null ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
