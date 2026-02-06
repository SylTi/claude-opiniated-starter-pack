"use client";

import { useCallback, useEffect, useState } from "react";
import { adminCouponsApi, ApiError } from "@/lib/api";
import type { CouponDTO } from "@saas/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCouponsPage(): React.ReactElement {
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponDTO | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    creditAmount: "",
    currency: "usd",
    expiresAt: "",
    isActive: true,
  });

  const fetchCoupons = useCallback(async (): Promise<void> => {
    try {
      const data = await adminCouponsApi.list();
      setCoupons(data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const resetForm = (): void => {
    setFormData({
      code: "",
      description: "",
      creditAmount: "",
      currency: "usd",
      expiresAt: "",
      isActive: true,
    });
    setEditingCoupon(null);
  };

  const openCreateDialog = (): void => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (coupon: CouponDTO): void => {
    if (coupon.redeemedByUserId !== null) {
      toast.error("Cannot edit a redeemed coupon");
      return;
    }
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      creditAmount: String(coupon.creditAmount),
      currency: coupon.currency,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split("T")[0] : "",
      isActive: coupon.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      setActionLoading(-1);
      const payload = {
        code: formData.code,
        description: formData.description || undefined,
        creditAmount: Number(formData.creditAmount),
        currency: formData.currency,
        expiresAt: formData.expiresAt || undefined,
        isActive: formData.isActive,
      };

      if (editingCoupon) {
        await adminCouponsApi.update(editingCoupon.id, payload);
        toast.success("Coupon updated successfully");
      } else {
        await adminCouponsApi.create(payload);
        toast.success("Coupon created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCoupons();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm("Are you sure you want to delete this coupon?")) {
      return;
    }

    try {
      setActionLoading(id);
      await adminCouponsApi.delete(id);
      toast.success("Coupon deleted successfully");
      fetchCoupons();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (coupon: CouponDTO): Promise<void> => {
    if (coupon.redeemedByUserId !== null) {
      toast.error("Cannot modify a redeemed coupon");
      return;
    }
    try {
      setActionLoading(coupon.id);
      await adminCouponsApi.update(coupon.id, { isActive: !coupon.isActive });
      toast.success(`Coupon ${coupon.isActive ? "disabled" : "enabled"}`);
      fetchCoupons();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const formatAmount = (amount: number, currency: string | undefined): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount / 100);
  };

  const getCouponStatus = (coupon: CouponDTO): { label: string; variant: "default" | "secondary" | "destructive" } => {
    if (coupon.redeemedByUserId !== null) {
      return { label: "Redeemed", variant: "secondary" };
    }
    if (!coupon.isActive) {
      return { label: "Inactive", variant: "destructive" };
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { label: "Expired", variant: "destructive" };
    }
    return { label: "Active", variant: "default" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
          <p className="text-muted-foreground">Manage single-use coupons for cash credits</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Coupon
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Credit Amount</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Redeemed By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            return (
              <TableRow key={coupon.id}>
                <TableCell>
                  <div>
                    <span className="font-mono font-semibold">{coupon.code}</span>
                    {coupon.description && (
                      <p className="text-sm text-muted-foreground">{coupon.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formatAmount(coupon.creditAmount, coupon.currency)}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(coupon.expiresAt)}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  {coupon.redeemedByUserEmail ? (
                    <div className="text-sm">
                      <p>{coupon.redeemedByUserEmail}</p>
                      <p className="text-muted-foreground">{formatDate(coupon.redeemedAt)}</p>
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(coupon)}
                      disabled={actionLoading === coupon.id || coupon.redeemedByUserId !== null}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {coupon.redeemedByUserId === null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(coupon)}
                        disabled={actionLoading === coupon.id}
                      >
                        {actionLoading === coupon.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : coupon.isActive ? (
                          "Disable"
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(coupon.id)}
                      disabled={actionLoading === coupon.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {coupons.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No coupons found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? "Edit Coupon" : "Create Coupon"}
            </DialogTitle>
            <DialogDescription>
              {editingCoupon
                ? "Update details for this coupon."
                : "Create a single-use coupon for account credits."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g., GIFT50"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="creditAmount">Credit Amount (cents)</Label>
                <Input
                  id="creditAmount"
                  type="number"
                  value={formData.creditAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, creditAmount: e.target.value })
                  }
                  placeholder="e.g., 5000 for $50"
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="expiresAt">Expiration Date</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading === -1}>
              {actionLoading === -1 && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCoupon ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
