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
import { toast } from "sonner";
import type { AdminUserDTO } from "@saas/shared";

export default function AdminUsersPage(): React.ReactElement {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchUsers = useCallback(async (): Promise<void> => {
    try {
      const response = await api.get<AdminUserDTO[]>("/api/v1/admin/users");
      if (response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
        if (error.statusCode === 401) {
          router.push("/login");
        }
      } else {
        toast.error("Failed to fetch users");
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

    if (user && user.role !== "admin") {
      toast.error("Access denied. Admin only.");
      router.push("/dashboard");
      return;
    }

    if (user) {
      fetchUsers();
    }
  }, [user, authLoading, router, fetchUsers]);

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

  async function handleDeleteUser(
    userId: number,
    email: string,
  ): Promise<void> {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    setActionLoading(userId);
    try {
      await api.delete(`/api/v1/admin/users/${userId}`);
      toast.success("User deleted successfully");
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

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
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
                    colSpan={8}
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
                            onClick={() => handleDeleteUser(u.id, u.email)}
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
    </div>
  );
}
