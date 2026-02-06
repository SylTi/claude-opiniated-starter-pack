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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { type AdminUserDTO } from "@saas/shared";

export default function AdminUsersPage(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId: number | null;
    email: string;
  }>({
    open: false,
    userId: null,
    email: "",
  });

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const usersResponse = await api.get<AdminUserDTO[]>(
        "/api/v1/admin/users",
      );
      if (usersResponse.data) {
        setUsers(usersResponse.data);
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
    fetchData();
  }, [fetchData]);

  async function handleVerifyEmail(userId: number): Promise<void> {
    setActionLoading(userId);
    try {
      await api.post(`/api/v1/admin/users/${userId}/verify-email`);
      toast.success("Email verified successfully");
      fetchData();
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
      fetchData();
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
      fetchData();
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

  function getTenantTypeBadgeVariant(
    type: string | null,
  ): "default" | "secondary" | "outline" {
    if (type === "team") return "default";
    if (type === "personal") return "secondary";
    return "outline";
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
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
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
                <TableHead>Current Tenant</TableHead>
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
                      {u.currentTenantName ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{u.currentTenantName}</span>
                          <Badge
                            variant={getTenantTypeBadgeVariant(
                              u.currentTenantType,
                            )}
                            className="w-fit text-xs"
                          >
                            {u.currentTenantType || "none"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.emailVerified ? (
                        <Badge variant="default">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Unverified</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.mfaEnabled ? (
                        <Badge variant="default">
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

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user {deleteDialog.email}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={actionLoading !== null}
            >
              {actionLoading !== null ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
